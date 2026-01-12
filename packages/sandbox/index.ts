export type { SandboxSession, PendingShutdown, Plan } from "./src/types";

export {
    activeSandboxes,
    pendingShutdowns,
    acquireProjectLock,
    releaseProjectLock,
} from "./src/session";

export {
    BACKUP_DEBOUNCE_MS,
    AUTO_BACKUP_INTERVAL_MS,
    POST_BACKUP_KILL_DELAY_MS,
    POST_STREAMING_SHUTDOWN_MS,
    MAX_STREAMING_WAIT_MS,
    IDLE_SHUTDOWN_MS,
} from "./src/session";
