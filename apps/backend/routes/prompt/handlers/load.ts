/**
 * MODULE: Load Project Handler - Sandbox Reuse & R2 Restoration
 *
 * This handler loads an existing project into a sandbox. It prioritizes
 * reusing existing active sandboxes over creating new ones.
 *
 *
 * DECISION FLOW:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                      handleLoadProject()                                │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 *   Request: POST /load/:projectId
 *         │
 *         ▼
 *   Check activeSandboxes map for this projectId
 *         │
 *         ├── Found existing sandbox?
 *         │         │
 *         │         ├── cancelPendingShutdown() (user came back)
 *         │         │
 *         │         ├── isBackingUp = true?
 *         │         │         └── Wait (poll every 1s, max 2 min) → Continue
 *         │         │
 *         │         └── Extend timeout → Return existing sandbox
 *         │
 *         └── No existing sandbox
 *                   │
 *                   ▼
 *             Create new Sandbox.create(TEMPLATE_ID)
 *                   │
 *                   ▼
 *             project.r2BackupPath exists?
 *                   │
 *                   ├── YES: initializeR2ForSandbox(shouldRestore: true)
 *                   │         │
 *                   │         └── Run `bun install` to restore node_modules
 *                   │
 *                   └── NO: Skip restoration
 *                   │
 *                   ▼
 *             Add to activeSandboxes → Return new sandbox info
 *
 *
 * KEY BEHAVIORS:
 * - Sandbox Reuse: Avoids spinning up duplicate sandboxes for same project
 * - Shutdown Cancel: If user returns during debounce, cancel shutdown and reuse
 * - Backup Wait: Polls for isBackingUp completion before reusing sandbox
 * - Post-Restore bun install: Dependencies are NOT stored in R2 (excluded), so
 *   they must be reinstalled after restoring project files from backup
 */

// Load project handler - POST /load/:projectId

import type { Response } from "express";
import { Sandbox } from "e2b";
import { prisma } from "@/lib/prisma";
import type { AuthRequest } from "@/middleware/auth";
import { initializeR2ForSandbox, isR2Configured } from "@/lib/r2";
import { activeSandboxes, acquireProjectLock, releaseProjectLock } from "@/routes/session";
import {
  cancelPendingShutdown,
  initializeCodeHash,
  startAutoBackup,
} from "@/routes/shutdown";
import { getOrCreateChat } from "@/routes/services";

const TEMPLATE_ID = process.env.TEMPLATE_ID;
const SANDBOX_PORT = process.env.SANDBOX_PORT;

export async function handleLoadProject(req: AuthRequest, res: Response) {
  const projectId = req.params.projectId;
  const userId = req.userId;

  if (!projectId) {
    return res.status(400).json({ error: "projectId is required" });
  }

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check if there's already an active sandbox for this project
    for (const [sandboxId, session] of activeSandboxes) {
      if (session.projectId === projectId) {
        console.log(
          `[LOAD] Found existing sandbox ${sandboxId} for project ${projectId}`
        );

        // Cancel any pending shutdown first (user came back)
        cancelPendingShutdown(sandboxId);

        // If actual backup is in progress, wait for it
        if (session.isBackingUp) {
          console.log(
            `[LOAD] Backup in progress for ${sandboxId}, waiting for completion...`
          );
          let waitTime = 0;
          const maxWaitTime = 120000;
          const pollInterval = 1000;

          while (session.isBackingUp && waitTime < maxWaitTime) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
            waitTime += pollInterval;
          }

          if (session.isBackingUp) {
            console.log(
              `[LOAD] Backup still in progress after ${maxWaitTime / 1000}s, proceeding anyway`
            );
          } else {
            console.log(`[LOAD] Backup completed, continuing with load`);
          }
        }

        try {
          await session.sandbox.setTimeout(15 * 60 * 1000);
          console.log(`[LOAD] Extended sandbox timeout to 15 minutes`);
        } catch (timeoutErr) {
          console.warn(`[LOAD] Could not extend sandbox timeout:`, timeoutErr);
        }

        return res.json({
          sandboxId,
          sandboxUrl: session.sandboxUrl,
          restored: false,
          message: "Using existing sandbox",
        });
      }
    }

    // Acquire lock to prevent race condition with concurrent requests
    await acquireProjectLock(projectId);

    let sandbox;
    let sandboxUrl: string;
    let sandboxId: string;

    try {
      // Double-check after acquiring lock (another request may have created sandbox while waiting)
      for (const [existingSandboxId, session] of activeSandboxes) {
        if (session.projectId === projectId) {
          console.log(
            `[LOAD] Sandbox ${existingSandboxId} was created while waiting for lock, reusing`
          );
          releaseProjectLock(projectId);
          cancelPendingShutdown(existingSandboxId);
          return res.json({
            sandboxId: existingSandboxId,
            sandboxUrl: session.sandboxUrl,
            restored: false,
            message: "Using existing sandbox",
          });
        }
      }

      console.log(`[LOAD] Creating new sandbox for project ${projectId}`);
      sandbox = await Sandbox.create(TEMPLATE_ID!, {
        timeoutMs: 300_000,
      });

      const host = sandbox.getHost(parseInt(SANDBOX_PORT!));
      sandboxUrl = `https://${host}`;
      sandboxId = sandbox.sandboxId;

      let restored = false;
      if (isR2Configured()) {
        const shouldRestore = !!project.r2BackupPath;
        console.log(
          `[LOAD] Initializing R2 for project ${projectId} (shouldRestore: ${shouldRestore})`
        );
        const result = await initializeR2ForSandbox(
          sandbox,
          userId,
          projectId,
          shouldRestore
        );
        restored = result.restored;
        if (result.mounted) {
          console.log(
            `[LOAD] R2 initialized${restored ? ", project restored from backup" : ", no backup to restore"}`
          );
        }

        if (restored) {
          console.log(`[LOAD] Running bun install to restore dependencies...`);
          try {
            const bunResult = await sandbox.commands.run(
              "cd /home/user && bun install 2>&1",
              { timeoutMs: 180000 }
            );

            if (bunResult.exitCode === 0) {
              console.log(`[LOAD] ✓ Dependencies installed successfully`);
            } else {
              console.error(
                `[LOAD] ✗ bun install failed with exit code ${bunResult.exitCode}`
              );
              console.error(`[LOAD] stdout:`, bunResult.stdout.slice(-500));
              console.error(`[LOAD] stderr:`, bunResult.stderr.slice(-500));
            }
          } catch (bunError) {
            console.error(`[LOAD] Error running bun install:`, bunError);
          }
        }
      }

      const chatId = await getOrCreateChat(projectId);

      activeSandboxes.set(sandboxId, {
        sandbox,
        messages: [],
        sandboxUrl,
        projectId,
        chatId,
        userId,
        createdAt: new Date(),
      });

      // Initialize code hash for backup change detection
      await initializeCodeHash(sandboxId);

      // Start auto-backup timer (backs up every 1 min if code changed)
      startAutoBackup(sandboxId);

      console.log(`[LOAD] Sandbox ${sandboxId} ready for project ${projectId}`);

      res.json({
        sandboxId,
        sandboxUrl,
        restored,
        message: restored
          ? "Project restored from backup"
          : "New sandbox created",
      });
    } finally {
      // Always release the lock
      releaseProjectLock(projectId);
    }
  } catch (error) {
    console.error("[LOAD] Error loading project:", error);
    res.status(500).json({ error: "Failed to load project" });
  }
}
