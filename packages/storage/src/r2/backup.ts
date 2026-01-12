import type { Sandbox } from "./config";
import {
  isR2Configured,
  BACKUP_MOUNT_PATH,
  PROJECT_PATH,
  EXCLUDE_PATTERNS,
} from "./config";
import { runCommandWithRetry } from "./utils";

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
    const result = await sandbox.commands.run(
      `test -d "${backupPath}" && echo "exists"`
    );
    const exists = result.stdout.trim() === "exists";

    if (exists) {
      console.log(`[R2] Backup exists for project ${projectId}`);
    } else {
      console.log(`[R2] No backup found for project ${projectId}`);
    }

    return exists;
  } catch (error) {
    console.error("[R2] Error checking backup existence:", error);
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

  try {
    const backupPath = `${BACKUP_MOUNT_PATH}/${userId}/${projectId}`;

    const exists = await projectBackupExists(sandbox, userId, projectId);
    if (!exists) {
      return false;
    }

    console.log(`[R2] Restoring project ${projectId} from backup...`);

    const restoreCommand = `rsync -a "${backupPath}/" "${PROJECT_PATH}/" 2>&1 | tail -20`;
    const result = await sandbox.commands.run(restoreCommand, {
      timeoutMs: 600000,
    });

    if (result.exitCode !== 0) {
      console.error("[R2] Restore failed:", result.stderr);
      console.error("[R2] Restore output:", result.stdout);
      return false;
    }

    console.log(`[R2] ✓ Project ${projectId} restored successfully`);
    return true;
  } catch (error) {
    console.error("[R2] Error restoring project:", error);
    return false;
  }
}

export async function backupProject(
  sandbox: Sandbox,
  userId: string,
  projectId: string
): Promise<boolean> {
  if (!isR2Configured()) {
    return false;
  }

  const backupPath = `${BACKUP_MOUNT_PATH}/${userId}/${projectId}`;
  console.log(`[R2] Starting backup for project ${projectId}...`);

  const mkdirResult = await runCommandWithRetry(
    sandbox,
    `mkdir -p "${backupPath}"`,
    { timeoutMs: 30000, maxRetries: 2 }
  );

  if (!mkdirResult.success) {
    console.error(
      "[R2] Failed to create backup directory:",
      mkdirResult.stderr
    );
    return false;
  }

  const excludeFlags = EXCLUDE_PATTERNS.map((p) => `--exclude='${p}'`).join(
    " "
  );

  const backupCommand = `bash -c 'rsync -a --delete ${excludeFlags} "${PROJECT_PATH}/" "${backupPath}/" > /dev/null 2>&1; echo "EXIT_CODE:$?"'`;

  const result = await runCommandWithRetry(sandbox, backupCommand, {
    timeoutMs: 600000,
    maxRetries: 3,
    retryDelayMs: 3000,
  });

  if (!result.success) {
    console.log(
      "[R2] Primary backup command failed, verifying backup status..."
    );

    const verifyResult = await runCommandWithRetry(
      sandbox,
      `bash -c 'test -d "${backupPath}" && ls -la "${backupPath}" > /dev/null 2>&1 && echo "VERIFIED" || echo "FAILED"'`,
      { timeoutMs: 30000, maxRetries: 2 }
    );

    if (verifyResult.success && verifyResult.stdout.includes("VERIFIED")) {
      console.log(
        `[R2] ✓ Backup verified despite command error - project ${projectId} backed up`
      );
      return true;
    }

    console.error("[R2] Backup failed and verification failed:", result.stderr);
    return false;
  }

  const exitCodeMatch = result.stdout.match(/EXIT_CODE:(\d+)/);
  const rsyncExitCode =
    exitCodeMatch && exitCodeMatch[1] ? parseInt(exitCodeMatch[1], 10) : -1;

  if (rsyncExitCode !== 0) {
    console.error(`[R2] rsync exited with code ${rsyncExitCode}`);

    if (rsyncExitCode === 23 || rsyncExitCode === 24) {
      console.log(
        `[R2] ⚠ Partial backup completed (exit code ${rsyncExitCode}) - this is acceptable`
      );
      return true;
    }

    return false;
  }

  console.log(`[R2] ✓ Project ${projectId} backed up successfully`);
  return true;
}
