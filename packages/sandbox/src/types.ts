import type { Sandbox } from "e2b";
import type { BaseMessage } from "@langchain/core/messages";

export interface Plan {
    projectType?: "update" | "full-stack" | "frontend-only" | "api-only";
    [key: string]: unknown;
}

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
