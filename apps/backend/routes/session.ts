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
    tabHiddenSince?: Date;
}

export interface PendingShutdown {
    timeoutId: NodeJS.Timeout;
    scheduledAt: Date;
    projectId: string;
    userId: string;
}

export const activeSandboxes = new Map<string, SandboxSession>();
export const pendingShutdowns = new Map<string, PendingShutdown>();
export const tabHiddenTimers = new Map<string, NodeJS.Timeout>();

export const SHUTDOWN_DELAY_MS = 2 * 60 * 1000;
export const TAB_HIDDEN_KILL_DELAY_MS = 3 * 60 * 1000;
