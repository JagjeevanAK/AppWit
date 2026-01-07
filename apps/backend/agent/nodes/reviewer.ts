// Reviewer node - validates generated files against plan and cleans up unused template files

import type { Sandbox } from "e2b";
import { log, type GraphStateType, type StreamConfig, type StreamEvent } from "./types";

// Files to remove based on project type
const BACKEND_FILES_TO_CLEANUP = [
  "/home/user/lib/db/index.ts",
  "/home/user/lib/db/schema.ts",
  "/home/user/drizzle.config.ts",
];

const BACKEND_DIRS_TO_CLEANUP = [
  "/home/user/lib/db",
  "/home/user/app/api",
];

/**
 * Cleans up unused template files based on project type.
 * Frontend-only projects don't need db/ or api/ scaffolding.
 */
async function cleanupUnusedFiles(
  sandbox: Sandbox,
  projectType: string,
  streamCallback?: (event: StreamEvent) => void
): Promise<string[]> {
  // Only cleanup for frontend-only projects
  if (projectType !== "frontend-only") {
    return [];
  }

  log.reviewer("Cleaning up unused backend/db files for frontend-only project...");
  streamCallback?.({
    type: "cleanup",
    message: "Removing unused backend scaffolding files...",
  });

  const removedFiles: string[] = [];

  // Remove individual files first
  for (const file of BACKEND_FILES_TO_CLEANUP) {
    try {
      await sandbox.files.remove(file);
      log.reviewer(`Removed: ${file}`);
      removedFiles.push(file);
      streamCallback?.({
        type: "file_removed",
        filePath: file,
        message: `Removed ${file}`,
      });
    } catch {
      // File might not exist, that's okay
    }
  }

  // Remove directories (recursive)
  for (const dir of BACKEND_DIRS_TO_CLEANUP) {
    try {
      await sandbox.commands.run(`rm -rf ${dir}`);
      log.reviewer(`Removed directory: ${dir}`);
      removedFiles.push(dir);
      streamCallback?.({
        type: "file_removed",
        filePath: dir,
        message: `Removed ${dir}`,
      });
    } catch {
      // Directory might not exist, that's okay
    }
  }

  if (removedFiles.length > 0) {
    log.reviewer(`Cleanup complete: removed ${removedFiles.length} unused files/directories`);
  }

  return removedFiles;
}

export function createReviewerNode(sandbox: Sandbox) {
  return async (
    state: GraphStateType,
    config?: StreamConfig
  ): Promise<Partial<GraphStateType>> => {
    // Skip review if no plan or already reviewed multiple times
    if (!state.plan || state.retryCount >= 2) {
      log.reviewer("Skipping review (no plan or max retries reached)");
      return {};
    }

    log.reviewer("Reviewing generated files against plan...");
    config?.configurable?.streamCallback?.({
      type: "reviewing",
      message: "Validating generated files...",
    });

    const writtenPaths = new Set(state.writtenFiles || []);
    const plannedPaths = state.plan.tasks
      .filter((t) => t.action !== "delete")
      .map((t) => t.file);

    const missingFiles = plannedPaths.filter((p) => !writtenPaths.has(p));
    const problems: string[] = [];

    // Check for missing files
    if (missingFiles.length > 0) {
      missingFiles.forEach((f) => {
        const task = state.plan!.tasks.find((t) => t.file === f);
        problems.push(
          `Missing: ${f} (${task?.description || "unknown purpose"})`
        );
      });
    }

    // Check for backend routes if project requires them
    if (state.projectType === "full-stack") {
      const hasApiRoute = state.writtenFiles?.some((f) => f.includes("/api/"));
      if (!hasApiRoute) {
        problems.push("Full-stack project missing API routes");
      }

      const hasSchemaUpdate = state.writtenFiles?.some((f) =>
        f.includes("schema.ts")
      );
      if (!hasSchemaUpdate) {
        problems.push("Full-stack project missing database schema updates");
      }
    }

    if (problems.length === 0) {
      log.reviewer("All tasks completed successfully");

      // Clean up unused template files for frontend-only projects
      await cleanupUnusedFiles(
        sandbox,
        state.projectType,
        config?.configurable?.streamCallback
      );

      config?.configurable?.streamCallback?.({
        type: "review_complete",
        message: "All planned files generated",
        reviewResult: {
          status: "success",
          message: "All tasks completed",
          problems: null,
          suggestions: null,
        },
      });
      return {
        reviewResult: {
          status: "success",
          message: "All tasks completed",
          problems: null,
          suggestions: null,
        },
      };
    }

    log.reviewer("Issues found:");
    problems.forEach((p) => log.reviewer(`  - ${p}`));

    config?.configurable?.streamCallback?.({
      type: "review_complete",
      message: `Review found ${problems.length} issues`,
      reviewResult: {
        status: "issues",
        message: null,
        problems,
        suggestions: ["Consider regenerating missing files"],
      },
    });

    return {
      reviewResult: {
        status: "issues",
        message: null,
        problems,
        suggestions: ["Consider regenerating missing files"],
      },
      retryCount: 1, // Increment retry count
    };
  };
}

export function shouldRetry(state: GraphStateType): "codegen" | "__end__" {
  // Don't retry more than once
  if (state.retryCount >= 2) {
    log.reviewer("Max retries reached, ending");
    return "__end__";
  }

  // Retry if review found issues and we haven't retried yet
  if (state.reviewResult?.status === "issues" && state.retryCount === 1) {
    log.reviewer("Triggering retry due to missing files");
    return "codegen";
  }

  return "__end__";
}
