import type { Sandbox } from "e2b";


const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

const BACKUP_MOUNT_PATH = "/mnt/backup";
const PROJECT_PATH = "/home/user";

const EXCLUDE_PATTERNS = [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    ".npm"
];

export function isR2Configured(): boolean {
    const configured = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
    return configured;
}

console.log(`[R2] Configuration status: ${isR2Configured() ? 'CONFIGURED' : 'NOT CONFIGURED'}`);

if (!isR2Configured()) {
    console.log(`[R2] Missing env vars - ACCOUNT_ID: ${!!R2_ACCOUNT_ID}, ACCESS_KEY: ${!!R2_ACCESS_KEY_ID}, SECRET_KEY: ${!!R2_SECRET_ACCESS_KEY}, BUCKET: ${!!R2_BUCKET_NAME}`);
}

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
        const result = await sandbox.commands.run(mountCommand, { timeoutMs: 30000 });

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
        // Check if the mount point exists and is accessible
        const result = await sandbox.commands.run(`mountpoint -q ${BACKUP_MOUNT_PATH} && echo "mounted"`);
        const isMounted = result.stdout.trim() === "mounted";
        console.log(`[R2] Mount check: ${isMounted ? 'mounted' : 'NOT mounted'}`);
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

    // Check if already mounted
    const alreadyMounted = await isR2Mounted(sandbox);
    if (alreadyMounted) {
        console.log("[R2] ✓ R2 mount verified - still active");
        return true;
    }

    console.log("[R2] Mount stale/missing, attempting to remount...");

    try {
        await sandbox.commands.run(`sudo fusermount -uz ${BACKUP_MOUNT_PATH} 2>/dev/null || true`);
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
        const result = await sandbox.commands.run(`test -d "${backupPath}" && echo "exists"`);
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

        // Copy files from backup to project directory
        const restoreCommand = `rsync -av --exclude='node_modules' "${backupPath}/" "${PROJECT_PATH}/"`;
        const result = await sandbox.commands.run(restoreCommand, { timeoutMs: 300000 });

        if (result.exitCode !== 0) {
            console.error("[R2] Restore failed:", result.stderr);
            console.error("[R2] Restore stdout:", result.stdout);
            return false;
        }

        const fileCount = result.stdout.split('\n').filter(line => line.trim() && !line.startsWith('sending')).length;
        console.log(`[R2] ✓ Project ${projectId} restored successfully (${fileCount} items restored)`);
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

    try {
        const backupPath = `${BACKUP_MOUNT_PATH}/${userId}/${projectId}`;

        console.log(`[R2] Starting backup for project ${projectId}...`);

        const mkdirResult = await sandbox.commands.run(`mkdir -p "${backupPath}"`);
        if (mkdirResult.exitCode !== 0) {
            console.error("[R2] Failed to create backup directory:", mkdirResult.stderr);
            return false;
        }

        // Build exclude string for rsync
        const excludeFlags = EXCLUDE_PATTERNS.map(p => `--exclude='${p}'`).join(" ");

        // Sync project files to backup
        const backupCommand = `rsync -av --delete ${excludeFlags} "${PROJECT_PATH}/" "${backupPath}/"`;

        const result = await sandbox.commands.run(backupCommand, { timeoutMs: 300000 });

        if (result.exitCode !== 0) {
            console.error("[R2] Backup failed:", result.stderr);
            console.error("[R2] Backup stdout:", result.stdout);
            return false;
        }

        // Log a summary of what was backed up
        const fileCount = result.stdout.split('\n').filter(line => line.trim() && !line.startsWith('sending')).length;
        console.log(`[R2] ✓ Project ${projectId} backed up successfully (${fileCount} items synced)`);
        return true;
    } catch (error) {
        console.error("[R2] Error backing up project:", error);
        return false;
    }
}

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

    console.log(`[R2] Initializing R2 for sandbox (restore: ${shouldRestore})...`);

    // Mount the bucket
    const mounted = await mountR2Bucket(sandbox);
    if (!mounted) {
        console.error("[R2] Failed to mount R2 bucket, cannot proceed with initialization");
        return { mounted: false, restored: false };
    }

    // Restore if requested
    let restored = false;
    if (shouldRestore) {
        restored = await restoreProject(sandbox, userId, projectId);
    }

    console.log(`[R2] Initialization complete - mounted: ${mounted}, restored: ${restored}`);
    return { mounted, restored };
}
