import type { Sandbox } from "./config";
import {
  isR2Configured,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  BACKUP_MOUNT_PATH,
} from "./config";

export async function mountR2Bucket(sandbox: Sandbox): Promise<boolean> {
  if (!isR2Configured()) {
    console.log("[R2] R2 not configured, skipping mount");
    return false;
  }

  try {
    console.log(`[R2] Starting mount for bucket: ${R2_BUCKET_NAME}`);

    await sandbox.files.makeDir(BACKUP_MOUNT_PATH);
    console.log(`[R2] Created mount directory: ${BACKUP_MOUNT_PATH}`);

    const credentials = `${R2_ACCESS_KEY_ID}:${R2_SECRET_ACCESS_KEY}`;
    await sandbox.files.write("/root/.passwd-s3fs", credentials);
    await sandbox.commands.run("sudo chmod 600 /root/.passwd-s3fs");
    console.log("[R2] Credentials file created");

    const mountCommand = `sudo s3fs ${R2_BUCKET_NAME} ${BACKUP_MOUNT_PATH} -o passwd_file=/root/.passwd-s3fs -o url=https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com -o use_path_request_style -o allow_other`;

    console.log(`[R2] Executing mount command...`);
    const result = await sandbox.commands.run(mountCommand, {
      timeoutMs: 30000,
    });

    if (result.exitCode !== 0) {
      console.error("[R2] Failed to mount bucket:", result.stderr);
      console.error("[R2] stdout:", result.stdout);
      return false;
    }

    console.log("[R2] ✓ R2 bucket mounted successfully");
    return true;
  } catch (error) {
    console.error("[R2] Error mounting R2 bucket:", error);
    return false;
  }
}

export async function isR2Mounted(sandbox: Sandbox): Promise<boolean> {
  if (!isR2Configured()) {
    return false;
  }

  try {
    const result = await sandbox.commands.run(
      `mountpoint -q ${BACKUP_MOUNT_PATH} && echo "mounted"`
    );
    const isMounted = result.stdout.trim() === "mounted";
    console.log(`[R2] Mount check: ${isMounted ? "mounted" : "NOT mounted"}`);
    return isMounted;
  } catch (error) {
    console.error("[R2] Error checking mount status:", error);
    return false;
  }
}

export async function ensureR2Mounted(sandbox: Sandbox): Promise<boolean> {
  if (!isR2Configured()) {
    console.log("[R2] R2 not configured, cannot ensure mount");
    return false;
  }

  console.log("[R2] Verifying R2 mount before backup...");

  const alreadyMounted = await isR2Mounted(sandbox);
  if (alreadyMounted) {
    console.log("[R2] ✓ R2 mount verified - still active");
    return true;
  }

  console.log("[R2] Mount stale/missing, attempting to remount...");

  try {
    await sandbox.commands.run(
      `sudo fusermount -uz ${BACKUP_MOUNT_PATH} 2>/dev/null || true`
    );
  } catch {
    // Ignore unmount errors
  }

  const remounted = await mountR2Bucket(sandbox);
  if (remounted) {
    console.log("[R2] ✓ Successfully remounted R2 bucket");
  } else {
    console.error("[R2] ✗ Failed to remount R2 bucket");
  }
  return remounted;
}
