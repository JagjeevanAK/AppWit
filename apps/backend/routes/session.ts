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
