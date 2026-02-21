import type { Sandbox } from "./config";
import {
  isR2Configured,
  BACKUP_MOUNT_PATH,
  PROJECT_PATH,
  EXCLUDE_PATTERNS,
} from "./config";
import { runCommandWithRetry } from "./utils";

/**
 * Check if a directory exists and contains at least one file.
 */
async function directoryHasFiles(
  sandbox: Sandbox,
  dirPath: string
): Promise<boolean> {
  try {
    const result = await sandbox.commands.run(
      `bash -c 'test -d "${dirPath}" && find "${dirPath}" -type f | head -1 | wc -l'`
    );
    return parseInt(result.stdout.trim(), 10) > 0;
  } catch {
    return false;
  }
}

export async function projectBackupExists(
  sandbox: Sandbox,
  userId: string,
  projectId: string
): Promise<boolean> {
  if (!isR2Configured()) {
    return false;
  }

  try {
    const backupPath = `${BACKUP_MOUNT_PATH}/${userId}/${projectId}`;
    const hasFiles = await directoryHasFiles(sandbox, backupPath);

    if (hasFiles) {
      console.log(`[R2] Backup exists with files for project ${projectId}`);
    } else {
      console.log(`[R2] No backup (or empty backup) found for project ${projectId}`);
    }

    return hasFiles;
  } catch (error) {
    console.error("[R2] Error checking backup existence:", error);
    return false;
  }
}

/**
 * Attempt to restore from a specific backup source path.
 * Returns true if restore succeeded and produced files.
 */
async function attemptRestore(
  sandbox: Sandbox,
  sourcePath: string,
  projectId: string
): Promise<boolean> {
  try {
    const restoreCommand = `rsync -a "${sourcePath}/" "${PROJECT_PATH}/" 2>&1 | tail -20`;
    const result = await sandbox.commands.run(restoreCommand, {
      timeoutMs: 600000,
    });

    if (result.exitCode !== 0) {
      console.error(`[R2] Restore from ${sourcePath} failed:`, result.stderr);
      return false;
    }

    // Verify restore produced files
    const hasFiles = await directoryHasFiles(sandbox, PROJECT_PATH);
    if (!hasFiles) {
      console.error(`[R2] Restore from ${sourcePath} produced empty project directory`);
      return false;
    }

    console.log(`[R2] Project ${projectId} restored from ${sourcePath}`);
    return true;
  } catch (error) {
    console.error(`[R2] Error restoring from ${sourcePath}:`, error);
    return false;
  }
}

export async function restoreProject(
  sandbox: Sandbox,
  userId: string,
  projectId: string
): Promise<boolean> {
  if (!isR2Configured()) {
    return false;
  }

  const backupPath = `${BACKUP_MOUNT_PATH}/${userId}/${projectId}`;
  const oldPath = `${backupPath}.old`;

  // Try primary backup first
  const primaryExists = await projectBackupExists(sandbox, userId, projectId);
  if (primaryExists) {
    console.log(`[R2] Restoring project ${projectId} from primary backup...`);
    const restored = await attemptRestore(sandbox, backupPath, projectId);
    if (restored) return true;
    console.warn(`[R2] Primary restore failed, checking .old fallback...`);
  }

  // Fallback: try .old backup (left from a previous atomic swap)
  const oldHasFiles = await directoryHasFiles(sandbox, oldPath);
  if (oldHasFiles) {
    console.log(`[R2] Falling back to .old backup for project ${projectId}...`);
    const restored = await attemptRestore(sandbox, oldPath, projectId);
    if (restored) {
      console.log(`[R2] Restored from .old backup successfully`);
      return true;
    }
  }

  console.error(`[R2] No valid backup found for project ${projectId}`);
  return false;
}

/**
 * Atomic backup using a staging directory.
 *
 * Phases:
 * 0. Clean leftover staging from previous failed attempt
 * 1. rsync to staging directory (no --delete, fresh copy)
 * 2. Verify staging has files
 * 3. Rotate: move current backup to .old
 * 4. Promote: move staging to live backup path
 * 5. Cleanup: remove .old (best-effort)
 *
 * If any phase fails, the previous backup remains intact (either at
 * backupPath or backupPath.old).
 */
export async function backupProject(
  sandbox: Sandbox,
  userId: string,
  projectId: string
): Promise<boolean> {
  if (!isR2Configured()) {
    return false;
  }

  const backupPath = `${BACKUP_MOUNT_PATH}/${userId}/${projectId}`;
  const stagingPath = `${backupPath}.staging`;
  const oldPath = `${backupPath}.old`;

  console.log(`[R2] Starting atomic backup for project ${projectId}...`);

  // Phase 0: Clean leftover staging from previous failed attempt
  await runCommandWithRetry(
    sandbox,
    `rm -rf "${stagingPath}"`,
    { timeoutMs: 30000, maxRetries: 2 }
  );

  // Phase 1: rsync to staging directory
  const mkdirResult = await runCommandWithRetry(
    sandbox,
    `mkdir -p "${stagingPath}"`,
    { timeoutMs: 30000, maxRetries: 2 }
  );

  if (!mkdirResult.success) {
    console.error("[R2] Failed to create staging directory:", mkdirResult.stderr);
    return false;
  }

  const excludeFlags = EXCLUDE_PATTERNS.map((p) => `--exclude='${p}'`).join(" ");

  // No --delete: staging is a fresh empty dir, so all files are new copies
  const rsyncCommand = `bash -c 'rsync -a ${excludeFlags} "${PROJECT_PATH}/" "${stagingPath}/" > /dev/null 2>&1; echo "EXIT_CODE:$?"'`;

  const result = await runCommandWithRetry(sandbox, rsyncCommand, {
    timeoutMs: 600000,
    maxRetries: 3,
    retryDelayMs: 3000,
  });

  // result.success reflects the outer bash wrapper exit code (echo always succeeds),
  // so we rely on the parsed EXIT_CODE from rsync's actual exit code below.
  // This guard only fires if the sandbox command itself failed (all retries exhausted).
  if (!result.success) {
    console.error("[R2] Sandbox command execution failed (all retries exhausted)");
    await runCommandWithRetry(sandbox, `rm -rf "${stagingPath}"`, { timeoutMs: 30000, maxRetries: 1 });
    return false;
  }

  const exitCodeMatch = result.stdout.match(/EXIT_CODE:(\d+)/);
  const rsyncExitCode = exitCodeMatch && exitCodeMatch[1] ? parseInt(exitCodeMatch[1], 10) : -1;

  // Accept 0 (success), 23/24 (partial transfer due to vanished source files,
  // common during active development — harmless since we're writing to a staging dir)
  if (rsyncExitCode !== 0 && rsyncExitCode !== 23 && rsyncExitCode !== 24) {
    console.error(`[R2] rsync to staging exited with code ${rsyncExitCode}`);
    await runCommandWithRetry(sandbox, `rm -rf "${stagingPath}"`, { timeoutMs: 30000, maxRetries: 1 });
    return false;
  }

  // Phase 2: Verify staging has meaningful content
  const stagingHasFiles = await directoryHasFiles(sandbox, stagingPath);
  if (!stagingHasFiles) {
    console.error("[R2] Staging directory is empty after rsync, aborting backup");
    await runCommandWithRetry(sandbox, `rm -rf "${stagingPath}"`, { timeoutMs: 30000, maxRetries: 1 });
    return false;
  }

  // Phase 3: Rotate — move current backup to .old (preserves rollback)
  const rotateResult = await runCommandWithRetry(
    sandbox,
    `bash -c 'rm -rf "${oldPath}" && { [ -d "${backupPath}" ] && mv "${backupPath}" "${oldPath}" || true; }'`,
    { timeoutMs: 30000, maxRetries: 2 }
  );

  if (!rotateResult.success) {
    console.error("[R2] Phase 3 rotate failed, aborting to preserve existing backup");
    await runCommandWithRetry(sandbox, `rm -rf "${stagingPath}"`, { timeoutMs: 30000, maxRetries: 1 });
    return false;
  }

  // Phase 4: Promote — move staging to live backup path
  const promoteResult = await runCommandWithRetry(
    sandbox,
    `mv "${stagingPath}" "${backupPath}"`,
    { timeoutMs: 30000, maxRetries: 2 }
  );

  if (!promoteResult.success) {
    console.error("[R2] Failed to promote staging to live backup:", promoteResult.stderr);
    // Rollback: restore .old to live
    await runCommandWithRetry(
      sandbox,
      `bash -c '[ -d "${oldPath}" ] && mv "${oldPath}" "${backupPath}" || true'`,
      { timeoutMs: 30000, maxRetries: 1 }
    );
    await runCommandWithRetry(sandbox, `rm -rf "${stagingPath}"`, { timeoutMs: 30000, maxRetries: 1 });
    return false;
  }

  // Phase 5: Cleanup .old (best-effort, non-critical)
  runCommandWithRetry(
    sandbox,
    `rm -rf "${oldPath}"`,
    { timeoutMs: 60000, maxRetries: 1 }
  ).catch(() => {
    console.log("[R2] Note: .old cleanup deferred, will be cleaned on next backup");
  });

  console.log(`[R2] Atomic backup complete for project ${projectId}`);
  return true;
}
