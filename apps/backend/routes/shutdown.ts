import { prisma } from "../lib/prisma";
import { backupProject, isR2Configured, ensureR2Mounted } from "../lib/r2";
import {
    activeSandboxes,
    pendingShutdowns,
    tabHiddenTimers,
    SHUTDOWN_DELAY_MS,
    TAB_HIDDEN_KILL_DELAY_MS
} from "./session";

export function cancelPendingShutdown(sandboxId: string): boolean {
    const pending = pendingShutdowns.get(sandboxId);
    if (pending) {
        clearTimeout(pending.timeoutId);
        pendingShutdowns.delete(sandboxId);
        console.log(`[SHUTDOWN] Cancelled pending kill for sandbox ${sandboxId} (backup already saved)`);
        return true;
    }
    return false;
}

async function performImmediateBackup(sandboxId: string, projectId: string, userId: string): Promise<boolean> {
    const session = activeSandboxes.get(sandboxId);

    if (!session) {
        console.log(`[BACKUP] Session ${sandboxId} not found, skipping backup`);
        return false;
    }

    if (!isR2Configured()) {
        console.log(`[BACKUP] R2 not configured, skipping backup`);
        return false;
    }

    console.log(`[BACKUP] Starting immediate backup for project ${projectId}...`);

    try {
        // Extend sandbox timeout to ensure it stays alive during backup
        try {
            await session.sandbox.setTimeout(10 * 60 * 1000); // 10 minutes
        } catch (timeoutErr) {
            console.warn(`[BACKUP] Could not extend sandbox timeout:`, timeoutErr);
        }

        // Ensure R2 is still mounted
        const mountReady = await ensureR2Mounted(session.sandbox);
        if (!mountReady) {
            console.error(`[BACKUP] ✗ Cannot backup - R2 mount not available`);
            return false;
        }

        // Perform backup
        const backed = await backupProject(session.sandbox, userId, projectId);

        if (backed) {
            // Update project with R2 backup path
            const r2BackupPath = `/${userId}/${projectId}/`;
            await prisma.project.update({
                where: { id: projectId },
                data: {
                    r2BackupPath,
                    lastBackupAt: new Date()
                }
            });
            console.log(`[BACKUP] ✓ Project ${projectId} backed up to ${r2BackupPath}`);
            return true;
        } else {
            console.error(`[BACKUP] ✗ Failed to backup project ${projectId}`);
            return false;
        }
    } catch (error) {
        console.error(`[BACKUP] Error during backup of ${projectId}:`, error);
        return false;
    }
}

// Perform only the kill (backup already done)
async function performKill(sandboxId: string): Promise<void> {
    const session = activeSandboxes.get(sandboxId);

    if (!session) {
        console.log(`[KILL] Session ${sandboxId} not found, skipping`);
        pendingShutdowns.delete(sandboxId);
        return;
    }

    console.log(`[KILL] Executing scheduled kill for sandbox ${sandboxId}`);

    try {
        await session.sandbox.kill();
        console.log(`[KILL] ✓ Sandbox ${sandboxId} killed successfully`);
    } catch (error) {
        console.error(`[KILL] Error killing sandbox ${sandboxId}:`, error);
    } finally {
        activeSandboxes.delete(sandboxId);
        pendingShutdowns.delete(sandboxId);
        tabHiddenTimers.delete(sandboxId);
    }
}

// Schedule shutdown: backup immediately, then schedule kill after delay
export async function scheduleShutdown(sandboxId: string, projectId: string, userId: string): Promise<void> {
    // Cancel any existing pending shutdown first
    cancelPendingShutdown(sandboxId);

    // Backup immediately (don't wait for delay)
    await performImmediateBackup(sandboxId, projectId, userId);

    // Schedule the actual kill after delay
    const timeoutId = setTimeout(async () => {
        await performKill(sandboxId);
    }, SHUTDOWN_DELAY_MS);

    pendingShutdowns.set(sandboxId, {
        timeoutId,
        scheduledAt: new Date(),
        projectId,
        userId
    });

    console.log(`[SHUTDOWN] Backup done. Kill scheduled in ${SHUTDOWN_DELAY_MS / 1000}s`);
}

// Schedule kill after tab has been hidden for 3 minutes
function scheduleTabHiddenKill(sandboxId: string): void {
    // Clear any existing timer
    const existingTimer = tabHiddenTimers.get(sandboxId);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
        await checkAndKillIfTabHidden(sandboxId);
    }, TAB_HIDDEN_KILL_DELAY_MS);

    tabHiddenTimers.set(sandboxId, timer);
    console.log(`[VISIBILITY] Kill scheduled for ${sandboxId} in ${TAB_HIDDEN_KILL_DELAY_MS / 1000}s if tab stays hidden`);
}

// Check conditions and kill if appropriate
async function checkAndKillIfTabHidden(sandboxId: string): Promise<void> {
    const session = activeSandboxes.get(sandboxId);
    tabHiddenTimers.delete(sandboxId);

    if (!session) {
        console.log(`[VISIBILITY] Session ${sandboxId} not found, skipping`);
        return;
    }

    // Check if tab is still hidden
    if (!session.isTabHidden) {
        console.log(`[VISIBILITY] Tab is now visible for ${sandboxId}, skipping kill`);
        return;
    }

    // Check if orchestration is still running
    if (session.isStreaming) {
        console.log(`[VISIBILITY] Orchestration still running for ${sandboxId}, rescheduling...`);
        // Reschedule check for 30 seconds later
        const timer = setTimeout(async () => {
            await checkAndKillIfTabHidden(sandboxId);
        }, 30000);
        tabHiddenTimers.set(sandboxId, timer);
        return;
    }

    // All conditions met - backup and kill
    const projectId = session.projectId;
    const userId = session.userId;

    if (projectId && userId) {
        console.log(`[VISIBILITY] Tab hidden for 3+ min, streaming done. Starting backup and kill for ${sandboxId}`);
        await scheduleShutdown(sandboxId, projectId, userId);
    } else {
        console.log(`[VISIBILITY] Missing projectId or userId for ${sandboxId}, skipping backup`);
        await performKill(sandboxId);
    }
}

// Handle tab visibility change
export function handleTabVisibilityChange(sandboxId: string, isHidden: boolean): void {
    const session = activeSandboxes.get(sandboxId);
    if (!session) {
        console.log(`[VISIBILITY] Session ${sandboxId} not found`);
        return;
    }

    session.isTabHidden = isHidden;

    if (isHidden) {
        session.tabHiddenSince = new Date();
        console.log(`[VISIBILITY] Tab hidden for sandbox ${sandboxId}`);

        // Schedule check after 3 minutes
        scheduleTabHiddenKill(sandboxId);
    } else {
        session.tabHiddenSince = undefined;
        console.log(`[VISIBILITY] Tab visible for sandbox ${sandboxId}`);

        // Cancel any pending tab hidden kill
        const existingTimer = tabHiddenTimers.get(sandboxId);
        if (existingTimer) {
            clearTimeout(existingTimer);
            tabHiddenTimers.delete(sandboxId);
            console.log(`[VISIBILITY] Cancelled pending tab hidden kill for ${sandboxId}`);
        }
    }
}
