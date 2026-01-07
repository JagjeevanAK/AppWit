/**
 * MODULE: Sandbox Shutdown Manager with Smart Backup
 *
 * SIMPLE RULES:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. USER LEAVES OR SWITCHES TAB → Wait 1 minute (debounce)
 * 2. AFTER 1 MIN → Check if code changed since last backup
 * 3. IF CODE CHANGED → Extend sandbox timeout, perform backup
 * 4. IF AGENT IS WORKING → Wait for completion first
 * 5. KILL sandbox after backup completes
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FLOW:
 *
 *   User leaves route OR switches tab
 *         │
 *         ▼
 *   Start 1-minute debounce timer
 *         │
 *         ├── User returns within 1 min? → Cancel timer, no backup
 *         │
 *         ▼ (1 min elapsed, user still away)
 *   Is agent streaming?
 *         │
 *         ├── YES → Wait for streaming to complete (max 10 min)
 *         │
 *         ▼ (streaming done OR was not streaming)
 *   Has code changed since last backup?
 *         │
 *         ├── NO → Skip backup, proceed to kill
 *         │
 *         ▼ (code changed)
 *   Extend sandbox timeout → Perform backup → Update lastCodeHash → Kill sandbox
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { prisma } from "../lib/prisma";
import {
  backupProject,
  isR2Configured,
  ensureR2Mounted,
  getProjectCodeHash,
} from "../lib/r2";
import {
  captureAndUploadScreenshot,
  isScreenshotEnabled,
} from "../lib/screenshot";
import {
  activeSandboxes,
  pendingShutdowns,
  BACKUP_DEBOUNCE_MS,
  AUTO_BACKUP_INTERVAL_MS,
  POST_BACKUP_KILL_DELAY_MS,
  POST_STREAMING_SHUTDOWN_MS,
  MAX_STREAMING_WAIT_MS,
} from "./session";

// Sandbox timeout extension before backup (5 minutes)
const SANDBOX_TIMEOUT_EXTENSION_MS = 5 * 60 * 1000;

/**
 * Cancel any pending shutdown/backup for the given sandbox.
 * Called when user returns to the project.
 */
export function cancelPendingShutdown(sandboxId: string): boolean {
  const session = activeSandboxes.get(sandboxId);
  if (session) {
    session.isShuttingDown = false;

    // Clear backup debounce timer if set
    if (session.backupDebounceTimer) {
      clearTimeout(session.backupDebounceTimer);
      session.backupDebounceTimer = undefined;
      console.log(`[SHUTDOWN] Cleared backup debounce timer for ${sandboxId}`);
    }
  }

  const pending = pendingShutdowns.get(sandboxId);
  if (pending?.timeoutId) {
    clearTimeout(pending.timeoutId);
    pendingShutdowns.delete(sandboxId);
    console.log(
      `[SHUTDOWN] Cancelled pending shutdown for sandbox ${sandboxId}`
    );
    return true;
  }

  return false;
}

/**
 * Extend sandbox timeout to prevent E2B from killing it during backup.
 */
async function extendSandboxTimeout(sandboxId: string): Promise<boolean> {
  const session = activeSandboxes.get(sandboxId);
  if (!session) return false;

  try {
    await session.sandbox.setTimeout(SANDBOX_TIMEOUT_EXTENSION_MS);
    console.log(
      `[SHUTDOWN] Extended sandbox timeout by ${SANDBOX_TIMEOUT_EXTENSION_MS / 1000}s`
    );
    return true;
  } catch (error) {
    console.error(`[SHUTDOWN] Failed to extend sandbox timeout:`, error);
    return false;
  }
}

/**
 * Check if code has changed since last backup.
 */
async function hasCodeChanged(sandboxId: string): Promise<boolean> {
  const session = activeSandboxes.get(sandboxId);
  if (!session) return false;

  try {
    const currentHash = await getProjectCodeHash(session.sandbox);
    if (!currentHash) {
      // If we can't get hash, assume code changed to be safe
      console.log(`[BACKUP] Could not get code hash, assuming code changed`);
      return true;
    }

    if (!session.lastCodeHash) {
      // First backup, no previous hash
      console.log(`[BACKUP] No previous hash, code considered changed`);
      return true;
    }

    const changed = currentHash !== session.lastCodeHash;
    console.log(
      `[BACKUP] Code hash check: ${changed ? "CHANGED" : "UNCHANGED"} (${currentHash.slice(0, 8)}... vs ${session.lastCodeHash.slice(0, 8)}...)`
    );
    return changed;
  } catch (error) {
    console.error(`[BACKUP] Error checking code hash:`, error);
    return true; // Assume changed on error
  }
}

/**
 * Perform backup to R2 storage.
 */
async function performBackup(
  sandboxId: string,
  projectId: string,
  userId: string
): Promise<boolean> {
  const session = activeSandboxes.get(sandboxId);

  if (!session) {
    console.log(`[BACKUP] Session ${sandboxId} not found, skipping backup`);
    return false;
  }

  if (session.isBackingUp) {
    console.log(
      `[BACKUP] Backup already in progress for ${sandboxId}, skipping`
    );
    return false;
  }

  if (!isR2Configured()) {
    console.log(`[BACKUP] R2 not configured, skipping backup`);
    return false;
  }

  // Extend sandbox timeout BEFORE backup to prevent E2B from killing it
  const timeoutExtended = await extendSandboxTimeout(sandboxId);
  if (!timeoutExtended) {
    console.warn(
      `[BACKUP] Could not extend sandbox timeout, backup may fail if sandbox times out`
    );
  }

  session.isBackingUp = true;
  console.log(`[BACKUP] Starting backup for project ${projectId}...`);

  try {
    const mountReady = await ensureR2Mounted(session.sandbox);
    if (!mountReady) {
      console.error(`[BACKUP] R2 mount not available`);
      session.isBackingUp = false;
      return false;
    }

    const backed = await backupProject(session.sandbox, userId, projectId);

    if (backed) {
      const r2BackupPath = `/${userId}/${projectId}/`;

      // Capture screenshot for thumbnail while sandbox is still running
      let thumbnailUrl: string | null = null;
      if (isScreenshotEnabled() && session.sandboxUrl) {
        console.log(`[BACKUP] Capturing thumbnail screenshot...`);
        thumbnailUrl = await captureAndUploadScreenshot(
          session.sandboxUrl,
          userId,
          projectId
        );
      }

      await prisma.project.update({
        where: { id: projectId },
        data: {
          r2BackupPath,
          lastBackupAt: new Date(),
          ...(thumbnailUrl && { thumbnailUrl }),
        },
      });

      // Update session with new code hash
      const newHash = await getProjectCodeHash(session.sandbox);
      if (newHash) {
        session.lastCodeHash = newHash;
      }
      session.lastBackupAt = new Date();

      console.log(
        `[BACKUP] ✓ Project ${projectId} backed up to ${r2BackupPath}${thumbnailUrl ? ` with thumbnail` : ""}`
      );
      session.isBackingUp = false;
      return true;
    } else {
      console.error(`[BACKUP] ✗ Failed to backup project ${projectId}`);
      session.isBackingUp = false;
      return false;
    }
  } catch (error) {
    console.error(`[BACKUP] Error during backup:`, error);
    session.isBackingUp = false;
    return false;
  }
}

/**
 * Kill the sandbox and cleanup.
 */
async function performKill(sandboxId: string): Promise<void> {
  const session = activeSandboxes.get(sandboxId);

  if (!session) {
    console.log(`[KILL] Session ${sandboxId} not found, skipping`);
    pendingShutdowns.delete(sandboxId);
    return;
  }

  // Clear any remaining timers
  if (session.backupDebounceTimer) {
    clearTimeout(session.backupDebounceTimer);
  }

  // Stop auto-backup timer
  if (session.autoBackupTimer) {
    clearInterval(session.autoBackupTimer);
  }

  console.log(`[KILL] Killing sandbox ${sandboxId}`);

  try {
    await session.sandbox.kill();
    console.log(`[KILL] ✓ Sandbox ${sandboxId} killed successfully`);
  } catch (error) {
    console.error(`[KILL] Error killing sandbox ${sandboxId}:`, error);
  } finally {
    activeSandboxes.delete(sandboxId);
    pendingShutdowns.delete(sandboxId);
  }
}

/**
 * Wait for streaming to complete.
 * Returns true if streaming completed, false if timed out.
 */
async function waitForStreaming(sandboxId: string): Promise<boolean> {
  const session = activeSandboxes.get(sandboxId);
  if (!session?.isStreaming) return true;

  console.log(`[SHUTDOWN] Waiting for agent to complete work...`);

  let waitTime = 0;
  while (session.isStreaming && waitTime < MAX_STREAMING_WAIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Check every 5s
    waitTime += 5000;

    // Re-check session exists
    const currentSession = activeSandboxes.get(sandboxId);
    if (!currentSession) return false;
    if (!currentSession.isStreaming) break;
  }

  if (session.isStreaming) {
    console.log(
      `[SHUTDOWN] Streaming still active after ${MAX_STREAMING_WAIT_MS / 1000}s, proceeding anyway`
    );
    return false;
  }

  console.log(`[SHUTDOWN] Agent work completed after ${waitTime / 1000}s`);
  return true;
}

/**
 * Execute the backup and shutdown sequence.
 * Called after the debounce period.
 */
async function executeBackupAndShutdown(
  sandboxId: string,
  projectId: string,
  userId: string
): Promise<void> {
  const session = activeSandboxes.get(sandboxId);

  if (!session) {
    console.log(`[SHUTDOWN] Session ${sandboxId} gone, aborting`);
    pendingShutdowns.delete(sandboxId);
    return;
  }

  // Check if shutdown was cancelled (user came back)
  if (!session.isShuttingDown) {
    console.log(`[SHUTDOWN] Shutdown cancelled for ${sandboxId}, aborting`);
    pendingShutdowns.delete(sandboxId);
    return;
  }

  // If agent is working, wait for it to complete
  if (session.isStreaming) {
    console.log(`[SHUTDOWN] Agent is working, waiting for completion...`);
    await waitForStreaming(sandboxId);

    // Re-check if shutdown was cancelled during wait
    const currentSession = activeSandboxes.get(sandboxId);
    if (!currentSession || !currentSession.isShuttingDown) {
      console.log(`[SHUTDOWN] Shutdown cancelled during streaming wait`);
      pendingShutdowns.delete(sandboxId);
      return;
    }

    // Wait additional time after streaming completes for any final changes
    console.log(
      `[SHUTDOWN] Agent done. Waiting ${POST_STREAMING_SHUTDOWN_MS / 1000}s for final changes...`
    );
    await new Promise((resolve) =>
      setTimeout(resolve, POST_STREAMING_SHUTDOWN_MS)
    );

    // Final check if shutdown was cancelled
    const finalSession = activeSandboxes.get(sandboxId);
    if (!finalSession || !finalSession.isShuttingDown) {
      console.log(`[SHUTDOWN] Shutdown cancelled during post-streaming wait`);
      pendingShutdowns.delete(sandboxId);
      return;
    }
  }

  // Check if code has changed since last backup
  const codeChanged = await hasCodeChanged(sandboxId);

  if (codeChanged) {
    console.log(`[SHUTDOWN] Code changed, performing backup...`);
    await performBackup(sandboxId, projectId, userId);

    // Wait for backup to complete if in progress
    const sessionAfterBackup = activeSandboxes.get(sandboxId);
    if (sessionAfterBackup?.isBackingUp) {
      console.log(`[SHUTDOWN] Waiting for backup to complete...`);
      let waitTime = 0;
      while (sessionAfterBackup.isBackingUp && waitTime < 120000) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        waitTime += 2000;
      }
    }

    // Small delay after backup before kill
    await new Promise((resolve) =>
      setTimeout(resolve, POST_BACKUP_KILL_DELAY_MS)
    );
  } else {
    console.log(`[SHUTDOWN] Code unchanged since last backup, skipping backup`);
  }

  // Kill sandbox
  await performKill(sandboxId);
  console.log(`[SHUTDOWN] ✓ Shutdown complete for sandbox ${sandboxId}`);
}

/**
 * Schedule shutdown with 1-minute debounce.
 * Called when user leaves route OR switches tab.
 */
export async function scheduleShutdown(
  sandboxId: string,
  projectId: string,
  userId: string
): Promise<void> {
  // Cancel any existing pending shutdown
  const existingPending = pendingShutdowns.get(sandboxId);
  if (existingPending?.timeoutId) {
    clearTimeout(existingPending.timeoutId);
  }

  const session = activeSandboxes.get(sandboxId);
  if (!session) {
    console.log(`[SHUTDOWN] Session ${sandboxId} not found`);
    return;
  }

  // Clear any existing debounce timer
  if (session.backupDebounceTimer) {
    clearTimeout(session.backupDebounceTimer);
  }

  // Mark as shutting down (blocks reopening)
  session.isShuttingDown = true;

  console.log(
    `[SHUTDOWN] Scheduled shutdown for ${sandboxId} in ${BACKUP_DEBOUNCE_MS / 1000}s (1 min debounce)`
  );

  // Schedule backup+shutdown after debounce period
  const timeoutId = setTimeout(async () => {
    await executeBackupAndShutdown(sandboxId, projectId, userId);
  }, BACKUP_DEBOUNCE_MS);

  // Store debounce timer in session for cancellation
  session.backupDebounceTimer = timeoutId;

  pendingShutdowns.set(sandboxId, {
    timeoutId,
    scheduledAt: new Date(),
    projectId,
    userId,
  });
}

/**
 * Handle tab visibility change.
 * Hidden = schedule shutdown (with 1 min debounce)
 * Visible = cancel shutdown
 */
export function handleTabVisibilityChange(
  sandboxId: string,
  isHidden: boolean
): void {
  const session = activeSandboxes.get(sandboxId);
  if (!session) {
    console.log(`[VISIBILITY] Session ${sandboxId} not found`);
    return;
  }

  session.isTabHidden = isHidden;

  if (isHidden) {
    console.log(
      `[VISIBILITY] Tab hidden for ${sandboxId}, scheduling shutdown...`
    );

    // Schedule shutdown if not already scheduled
    if (!session.isShuttingDown && session.projectId && session.userId) {
      scheduleShutdown(sandboxId, session.projectId, session.userId);
    }
  } else {
    console.log(`[VISIBILITY] Tab visible for ${sandboxId}`);

    // Cancel shutdown if user returns
    cancelPendingShutdown(sandboxId);
  }
}

/**
 * Check if a sandbox is currently shutting down.
 */
export function isSandboxShuttingDown(sandboxId: string): boolean {
  const session = activeSandboxes.get(sandboxId);
  return session?.isShuttingDown ?? false;
}

/**
 * Check if a project has any sandbox currently shutting down.
 */
export function isProjectShuttingDown(projectId: string): {
  shutting: boolean;
  sandboxId?: string;
} {
  for (const [sandboxId, session] of activeSandboxes) {
    if (session.projectId === projectId && session.isShuttingDown) {
      return { shutting: true, sandboxId };
    }
  }
  return { shutting: false };
}

/**
 * Initialize code hash for a new session (call after sandbox is created).
 * This establishes the baseline for change detection.
 */
export async function initializeCodeHash(sandboxId: string): Promise<void> {
  const session = activeSandboxes.get(sandboxId);
  if (!session) return;

  try {
    const hash = await getProjectCodeHash(session.sandbox);
    if (hash) {
      session.lastCodeHash = hash;
      console.log(
        `[BACKUP] Initialized code hash for ${sandboxId}: ${hash.slice(0, 8)}...`
      );
    }
  } catch (error) {
    console.error(`[BACKUP] Error initializing code hash:`, error);
  }
}

// ============================================
// AUTO-BACKUP (runs every 1 minute while active)
// ============================================

/**
 * Perform auto-backup if code has changed.
 * This runs on interval while the sandbox is active.
 */
async function runAutoBackup(sandboxId: string): Promise<void> {
  const session = activeSandboxes.get(sandboxId);

  if (!session) {
    console.log(`[AUTO-BACKUP] Session ${sandboxId} not found, stopping`);
    return;
  }

  // Skip if already backing up, shutting down, or streaming
  if (session.isBackingUp) {
    console.log(`[AUTO-BACKUP] Backup already in progress, skipping`);
    return;
  }

  if (session.isShuttingDown) {
    console.log(`[AUTO-BACKUP] Sandbox is shutting down, skipping`);
    return;
  }

  if (session.isStreaming) {
    console.log(`[AUTO-BACKUP] Agent is streaming, skipping this cycle`);
    return;
  }

  // Check if code has changed
  const codeChanged = await hasCodeChanged(sandboxId);

  if (!codeChanged) {
    console.log(`[AUTO-BACKUP] Code unchanged, skipping backup`);
    return;
  }

  // Perform backup
  const { projectId, userId } = session;
  if (!projectId || !userId) {
    console.log(`[AUTO-BACKUP] Missing projectId or userId, skipping`);
    return;
  }

  console.log(`[AUTO-BACKUP] Code changed, starting backup...`);
  await performBackup(sandboxId, projectId, userId);
}

/**
 * Start auto-backup timer for a sandbox.
 * This runs every AUTO_BACKUP_INTERVAL_MS (1 minute) and backs up if code changed.
 */
export function startAutoBackup(sandboxId: string): void {
  const session = activeSandboxes.get(sandboxId);
  if (!session) {
    console.log(`[AUTO-BACKUP] Session ${sandboxId} not found`);
    return;
  }

  // Clear existing timer if any
  if (session.autoBackupTimer) {
    clearInterval(session.autoBackupTimer);
  }

  console.log(
    `[AUTO-BACKUP] Starting auto-backup timer for ${sandboxId} (every ${AUTO_BACKUP_INTERVAL_MS / 1000}s)`
  );

  // Start interval timer
  session.autoBackupTimer = setInterval(async () => {
    await runAutoBackup(sandboxId);
  }, AUTO_BACKUP_INTERVAL_MS);
}

/**
 * Stop auto-backup timer for a sandbox.
 */
export function stopAutoBackup(sandboxId: string): void {
  const session = activeSandboxes.get(sandboxId);
  if (!session) return;

  if (session.autoBackupTimer) {
    clearInterval(session.autoBackupTimer);
    session.autoBackupTimer = undefined;
    console.log(`[AUTO-BACKUP] Stopped auto-backup timer for ${sandboxId}`);
  }
}
