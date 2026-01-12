/**
 * MODULE: R2 Storage Integration - FUSE-Based Cloud Persistence
 *
 * This module provides Cloudflare R2 (S3-compatible) storage for persisting
 * project files between sandbox sessions. It uses s3fs-fuse to mount the
 * R2 bucket as a local filesystem inside the E2B sandbox.
 *
 *
 * MOUNT LIFECYCLE:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                     S3FS Mount Flow                                     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 *   Sandbox Created
 *         │
 *         ▼
 *   mountR2Bucket()
 *   ┌──────────────────────────────────────────┐
 *   │ 1. Create mount point: /mnt/backup      │
 *   │ 2. Write credentials to ~/.passwd-s3fs  │
 *   │ 3. Execute s3fs mount command           │
 *   │ 4. Bucket now accessible at /mnt/backup │
 *   └──────────────────────────────────────────┘
 *         │
 *         ▼
 *   [Sandbox active - read/write to R2 via /mnt/backup]
 *         │
 *         ▼
 *   ensureR2Mounted() ← Called before backup
 *   ┌──────────────────────────────────────────┐
 *   │ Check if still mounted (mountpoint -q)  │
 *   │ If stale: unmount + remount             │
 *   └──────────────────────────────────────────┘
 *
 *
 * BACKUP STRATEGY (backupProject):
 * Uses rsync with careful error handling for E2B environment quirks:
 *
 *   rsync -a --delete [excludes] /home/user/ /mnt/backup/{userId}/{projectId}/
 *         │      │         │
 *         │      │         └── Skip: node_modules, .git, dist, build, .next, .npm, .cache
 *         │      └── Remove files in backup that no longer exist in source
 *         └── Archive mode (preserves permissions, timestamps)
 *
 * Exit Code Handling:
 *   0  → Success
 *   23 → Partial transfer (some files couldn't be transferred) → Acceptable
 *   24 → Partial transfer due to vanished files → Acceptable (active dev)
 *   Other → Failure, but verify backup exists as fallback
 *
 *
 * ERROR HANDLING (runCommandWithRetry):
 * E2B can throw protocol errors for commands with large/compressed output.
 * This function wraps commands with:
 *   - Up to 3 retries with exponential backoff
 *   - Graceful handling of "protocol error" and "compressed output" errors
 *   - Fallback verification (check if operation succeeded despite error)
 *
 *
 * DELETION (deleteProjectFromR2):
 * Unlike backup (which uses mounted filesystem), deletion uses the AWS SDK
 * directly via S3 API calls. This is because deletion may happen after
 * sandbox is killed (no mount available).
 *
 *   S3Client → ListObjectsV2 (paginated) → DeleteObjects (batch of 1000)
 */

import type { Sandbox } from "./config";
import { isR2Configured } from "./config";
import { mountR2Bucket, isR2Mounted, ensureR2Mounted } from "./mount";
import { getProjectCodeHash } from "./hash";
import { backupProject, restoreProject, projectBackupExists } from "./backup";
import { deleteProjectFromR2 } from "./s3-client";

export async function initializeR2ForSandbox(
  sandbox: Sandbox,
  userId: string,
  projectId: string,
  shouldRestore: boolean = false
): Promise<{ mounted: boolean; restored: boolean }> {
  if (!isR2Configured()) {
    console.log("[R2] R2 not configured, skipping initialization");
    return { mounted: false, restored: false };
  }

  console.log(
    `[R2] Initializing R2 for sandbox (restore: ${shouldRestore})...`
  );

  const mounted = await mountR2Bucket(sandbox);
  if (!mounted) {
    console.error(
      "[R2] Failed to mount R2 bucket, cannot proceed with initialization"
    );
    return { mounted: false, restored: false };
  }

  let restored = false;
  if (shouldRestore) {
    restored = await restoreProject(sandbox, userId, projectId);
  }

  console.log(
    `[R2] Initialization complete - mounted: ${mounted}, restored: ${restored}`
  );
  return { mounted, restored };
}

export {
  isR2Configured,
  mountR2Bucket,
  isR2Mounted,
  ensureR2Mounted,
  projectBackupExists,
  restoreProject,
  backupProject,
  deleteProjectFromR2,
  getProjectCodeHash,
};
