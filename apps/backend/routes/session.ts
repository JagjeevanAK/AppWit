import type { Sandbox } from "e2b";
import type { BaseMessage } from "@langchain/core/messages";
import type { Plan } from "../agent/types";

export interface SandboxSession {
  sandbox: Sandbox;
  messages: BaseMessage[];
  sandboxUrl: string;
  plan?: Plan;
  projectId?: string;
  chatId?: string;
  userId?: string;
  isStreaming?: boolean;
  isTabHidden?: boolean;
  isBackingUp?: boolean;
  isShuttingDown?: boolean;
  createdAt: Date;
  // Backup tracking
  lastBackupAt?: Date;
  lastCodeHash?: string;
  // Debounce timer for backup (shutdown flow)
  backupDebounceTimer?: NodeJS.Timeout;
  // Auto-backup interval timer (runs every AUTO_BACKUP_INTERVAL_MS)
  autoBackupTimer?: NodeJS.Timeout;
}

export interface PendingShutdown {
  timeoutId: NodeJS.Timeout | null;
  scheduledAt: Date;
  projectId: string;
  userId: string;
}

export const activeSandboxes = new Map<string, SandboxSession>();
export const pendingShutdowns = new Map<string, PendingShutdown>();

// ============================================
// SHUTDOWN TIMING CONSTANTS
// ============================================

// Time to wait before starting backup when user leaves/switches tab (1 minute debounce)
export const BACKUP_DEBOUNCE_MS = 1 * 60 * 1000;

// Auto-backup interval: backup every 1 minute while user is active (if code changed)
export const AUTO_BACKUP_INTERVAL_MS = 1 * 60 * 1000;

// Time to wait after backup completes before killing sandbox (30 seconds buffer)
export const POST_BACKUP_KILL_DELAY_MS = 30 * 1000;

// Legacy: Time to wait before shutdown (keeping for backwards compatibility, but not used in new flow)
export const IDLE_SHUTDOWN_MS = 1 * 60 * 1000;

// Time to wait after agent completes work before shutdown (3 minutes)
export const POST_STREAMING_SHUTDOWN_MS = 3 * 60 * 1000;

// Max time to wait for streaming to complete before force shutdown (10 minutes)
export const MAX_STREAMING_WAIT_MS = 10 * 60 * 1000;

// ============================================
// PROJECT CREATION LOCK (prevents duplicate sandbox creation)
// ============================================

// Track in-progress sandbox creation per project
const projectCreationLocks = new Map<string, { promise: Promise<void>; resolve: () => void }>();

/**
 * Acquire a lock for project sandbox creation.
 * If another request is already creating a sandbox for this project,
 * this will wait until that creation completes.
 */
export async function acquireProjectLock(projectId: string): Promise<void> {
  const existingLock = projectCreationLocks.get(projectId);
  if (existingLock) {
    console.log(`[LOCK] Waiting for existing sandbox creation for project ${projectId}`);
    await existingLock.promise;
  }

  // Create new lock
  let resolveFunc: () => void = () => { };
  const promise = new Promise<void>((resolve) => {
    resolveFunc = resolve;
  });
  projectCreationLocks.set(projectId, { promise, resolve: resolveFunc });
  console.log(`[LOCK] Acquired lock for project ${projectId}`);
}

/**
 * Release the project creation lock.
 */
export function releaseProjectLock(projectId: string): void {
  const lock = projectCreationLocks.get(projectId);
  if (lock) {
    lock.resolve();
    projectCreationLocks.delete(projectId);
    console.log(`[LOCK] Released lock for project ${projectId}`);
  }
}

