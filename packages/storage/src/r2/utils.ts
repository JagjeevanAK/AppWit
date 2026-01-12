import type { Sandbox } from "./config";

export interface CommandResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RetryOptions {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Execute a sandbox command with retry logic and proper error handling.
 * Handles E2B protocol errors (like "unsupported compressed output") gracefully.
 */
export async function runCommandWithRetry(
  sandbox: Sandbox,
  command: string,
  options: RetryOptions = {}
): Promise<CommandResult> {
  const { timeoutMs = 120000, maxRetries = 3, retryDelayMs = 2000 } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await sandbox.commands.run(command, { timeoutMs });
      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isProtocolError =
        errorMessage.includes("protocol error") ||
        errorMessage.includes("compressed output") ||
        errorMessage.includes("SandboxError");

      console.log(
        `[R2] Command attempt ${attempt}/${maxRetries} failed: ${errorMessage.slice(0, 100)}`
      );

      if (attempt < maxRetries) {
        const delay = retryDelayMs * attempt;
        console.log(`[R2] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));

        if (isProtocolError && attempt === maxRetries - 1) {
          console.log(
            `[R2] Protocol error detected, will try simplified command on next attempt`
          );
        }
      } else {
        console.error(`[R2] All ${maxRetries} attempts failed`);
        return {
          success: false,
          exitCode: -1,
          stdout: "",
          stderr: errorMessage,
        };
      }
    }
  }

  return {
    success: false,
    exitCode: -1,
    stdout: "",
    stderr: "Max retries exceeded",
  };
}
