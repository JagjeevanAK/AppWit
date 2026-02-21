import type { Sandbox } from "./config";
import { PROJECT_PATH } from "./config";

/**
 * Generate a hash of the project files to detect changes.
 * Uses find + stat on key files (excluding node_modules, etc.)
 * Only uses file name and size (NOT modification time) to avoid
 * false positives when restoring from backup (timestamps may differ).
 * Returns a hash string or null if failed.
 */
export async function getProjectCodeHash(
  sandbox: Sandbox
): Promise<string | null> {
  try {
    const dirExcludes = [
      "node_modules",
      ".git",
      "dist",
      "build",
      ".next",
      ".npm",
      ".cache",
      ".bun",
    ];
    const fileExcludes = [
      "bun.lockb",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      ".DS_Store",
    ];

    const dirExcludeArgs = dirExcludes
      .map((d) => `-path "*/${d}" -prune`)
      .join(" -o ");
    const fileExcludeArgs = fileExcludes.map((f) => `! -name "${f}"`).join(" ");

    const hashCommand = `find ${PROJECT_PATH} \\( ${dirExcludeArgs} \\) -o -type f ${fileExcludeArgs} -print0 2>/dev/null | xargs -0 stat --format='%n %s' 2>/dev/null | sort | md5sum | cut -d' ' -f1`;

    const result = await sandbox.commands.run(hashCommand, {
      timeoutMs: 30000,
    });

    if (result.exitCode === 0 && result.stdout.trim()) {
      return result.stdout.trim();
    }

    const fallbackCommand = `find ${PROJECT_PATH} -type f ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/.next/*" ! -path "*/dist/*" ! -path "*/build/*" ! -path "*/.bun/*" ! -path "*/.npm/*" ! -path "*/.cache/*" ! -name "bun.lockb" ! -name "package-lock.json" ! -name "yarn.lock" ! -name "pnpm-lock.yaml" ! -name ".DS_Store" -exec stat --format='%n %s' {} \\; 2>/dev/null | sort | md5sum | cut -d' ' -f1`;
    const fallbackResult = await sandbox.commands.run(fallbackCommand, {
      timeoutMs: 30000,
    });

    if (fallbackResult.exitCode === 0 && fallbackResult.stdout.trim()) {
      return fallbackResult.stdout.trim();
    }

    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : "";

    const sandboxDead =
      name === "NotFoundError" ||
      name === "TimeoutError" ||
      message.includes("Sandbox is probably not running anymore") ||
      message.includes("sandbox timeout") ||
      message.includes("not found");

    if (sandboxDead) {
      throw error;
    }

    console.error("[R2] Error generating code hash:", error);
    return null;
  }
}
