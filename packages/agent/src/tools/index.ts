import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { Sandbox } from "e2b";
import { getThemeList, getThemeCSS, type ThemeInfo } from "../data/themes";

export function createSandboxTools(sandbox: Sandbox) {
  const createFileTool = tool(
    async ({ location, content }) => {
      try {
        const dir = location.substring(0, location.lastIndexOf("/"));
        if (dir) {
          await sandbox.commands.run(`mkdir -p ${dir}`);
        }
        await sandbox.files.write(location, content || "");
        console.log(`[TOOL] createFile: ${location}`);
        return `File created successfully at ${location}`;
      } catch (error) {
        console.error(`[TOOL] createFile ERROR: ${error}`);
        return `Error creating file: ${error}`;
      }
    },
    {
      name: "createFile",
      description:
        "Create a NEW file that doesn't exist yet. This will also create parent directories if needed.",
      schema: z.object({
        location: z
          .string()
          .describe(
            "Absolute path to the file (e.g., /home/user/components/Button.tsx)"
          ),
        content: z.string().describe("Complete content of the file"),
      }),
    }
  );

  const updateFileTool = tool(
    async ({ location, content }) => {
      try {
        await sandbox.files.write(location, content);
        console.log(`[TOOL] updateFile: ${location}`);
        return `File updated successfully at ${location}`;
      } catch (error) {
        console.error(`[TOOL] updateFile ERROR: ${error}`);
        return `Error updating file: ${error}`;
      }
    },
    {
      name: "updateFile",
      description:
        "Update an EXISTING file. Use this to modify files like App.tsx, App.css that already exist.",
      schema: z.object({
        location: z.string().describe("Absolute path to the file to update"),
        content: z.string().describe("Complete new content of the file"),
      }),
    }
  );

  const deleteFileTool = tool(
    async ({ location }) => {
      try {
        await sandbox.files.remove(location);
        console.log(`[TOOL] deleteFile: ${location}`);
        return `File deleted successfully at ${location}`;
      } catch (error) {
        console.error(`[TOOL] deleteFile ERROR: ${error}`);
        return `Error deleting file: ${error}`;
      }
    },
    {
      name: "deleteFile",
      description: "Delete a file at a certain directory path",
      schema: z.object({
        location: z.string().describe("Absolute path to the file to delete"),
      }),
    }
  );

  const readFileTool = tool(
    async ({ location }) => {
      try {
        const content = await sandbox.files.read(location);
        console.log(`[TOOL] readFile: ${location}`);
        return content;
      } catch (error) {
        console.error(`[TOOL] readFile ERROR: ${error}`);
        return `Error reading file: ${error}`;
      }
    },
    {
      name: "readFile",
      description: "Read the contents of an existing file",
      schema: z.object({
        location: z.string().describe("Absolute path to the file to read"),
      }),
    }
  );

  const listFilesTool = tool(
    async ({ path }) => {
      try {
        const files = await sandbox.files.list(path);
        console.log(`[TOOL] listFiles: ${path}`);
        return `Files in ${path}:\n${files.map((f) => `- ${f.name}${f.type === "dir" ? "/" : ""}`).join("\n")}`;
      } catch (error) {
        console.error(`[TOOL] listFiles ERROR: ${error}`);
        return `Error listing files: ${error}`;
      }
    },
    {
      name: "listFiles",
      description: "List all files in a directory",
      schema: z.object({
        path: z
          .string()
          .default("/home/user")
          .describe("Directory path to list files from"),
      }),
    }
  );

  const runCommandTool = tool(
    async ({ command }) => {
      try {
        const result = await sandbox.commands.run(command);
        console.log(`[TOOL] runCommand: ${command}`);
        return `Exit code: ${result.exitCode}\nStdout: ${result.stdout}\nStderr: ${result.stderr}`;
      } catch (error) {
        console.error(`[TOOL] runCommand ERROR: ${error}`);
        return `Error running command: ${error}`;
      }
    },
    {
      name: "runCommand",
      description: "Run a terminal command in the sandbox environment",
      schema: z.object({
        command: z.string().describe("The command to run in the terminal"),
      }),
    }
  );

  const getThemeInfoTool = tool(
    async () => {
      try {
        const themeList = getThemeList();
        console.log(`[TOOL] getThemeInfo: listing ${themeList.length} themes`);

        const formattedList = themeList
          .map(
            (theme: ThemeInfo) =>
              `- **${theme.name}** (${theme.name.toLowerCase().replace(/\s+/g, "-")}): ${theme.description}\n  Best for: ${theme.bestFor.join(", ")}`
          )
          .join("\n\n");

        return `Available shadcn themes:\n\n${formattedList}\n\nUSAGE: Call getTheme with the theme name to get the CSS content, then paste it into /home/user/app/globals.css`;
      } catch (error) {
        console.error(`[TOOL] getThemeInfo ERROR: ${error}`);
        return `Error getting theme info: ${error}`;
      }
    },
    {
      name: "getThemeInfo",
      description:
        "Get a list of all available pre-built shadcn themes with descriptions. Use this FIRST to choose the right theme for the project, then call getTheme to get the CSS.",
      schema: z.object({}),
    }
  );

  const getThemeTool = tool(
    async ({ themeName }) => {
      try {
        const css = getThemeCSS(themeName);
        if (!css) {
          const availableThemes = getThemeList()
            .map((t) => t.name.toLowerCase().replace(/\s+/g, "-"))
            .join(", ");
          return `Theme "${themeName}" not found. Available themes: ${availableThemes}`;
        }
        console.log(`[TOOL] getTheme: ${themeName}`);
        return css;
      } catch (error) {
        console.error(`[TOOL] getTheme ERROR: ${error}`);
        return `Error getting theme: ${error}`;
      }
    },
    {
      name: "getTheme",
      description:
        "Get the CSS content for a specific theme. Use this to download a theme, then paste the entire CSS into /home/user/app/globals.css to apply it. ALWAYS add '@import \"tailwindcss\";' at the TOP of globals.css before the theme CSS.",
      schema: z.object({
        themeName: z
          .string()
          .describe(
            'Theme name (e.g., "vercel", "darkmatter", "twitter", "caffeine", "claymorphism", "graphite", "mocha-mousse", "elegant-luxury", "sage-garden", "amethyst-haze")'
          ),
      }),
    }
  );

  const searchTextTool = tool(
    async ({ pattern, path, filePattern }) => {
      try {
        const searchPath = path || "/home/user";
        const globPattern = filePattern || "*";

        // Build ripgrep command with JSON output
        // Exclude common directories that shouldn't be searched
        const excludes = [
          "--glob=!node_modules",
          "--glob=!.next",
          "--glob=!.git",
          "--glob=!dist",
          "--glob=!build",
          "--glob=!.cache",
          "--glob=!*.lock",
        ].join(" ");

        const cmd = `rg --json ${excludes} --glob="${globPattern}" "${pattern}" ${searchPath} 2>/dev/null || true`;

        const result = await sandbox.commands.run(cmd, { timeoutMs: 30000 });
        console.log(
          `[TOOL] searchText: pattern="${pattern}" path="${searchPath}"`
        );

        if (!result.stdout.trim()) {
          return JSON.stringify({
            matches: [],
            count: 0,
            message: "No matches found",
          });
        }

        // Parse ripgrep JSON output
        const matches: Array<{
          file: string;
          line: number;
          text: string;
          column?: number;
        }> = [];
        const lines = result.stdout.trim().split("\n");

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "match") {
              matches.push({
                file: event.data.path.text,
                line: event.data.line_number,
                column: event.data.submatches?.[0]?.start,
                text: event.data.lines.text.trimEnd(),
              });
            }
          } catch {
            // Skip malformed JSON lines
          }
        }

        return JSON.stringify({
          matches,
          count: matches.length,
          message: `Found ${matches.length} match(es)`,
        });
      } catch (error) {
        console.error(`[TOOL] searchText ERROR: ${error}`);
        return `Error searching: ${error}`;
      }
    },
    {
      name: "searchText",
      description:
        "Search for text or regex pattern in project files using ripgrep. Returns matching files with line numbers. Use this BEFORE replaceInFile to find files containing the pattern.",
      schema: z.object({
        pattern: z.string().describe("Text or regex pattern to search for"),
        path: z
          .string()
          .optional()
          .describe("Directory to search in (default: /home/user)"),
        filePattern: z
          .string()
          .optional()
          .describe('Glob pattern to filter files (e.g., "*.tsx", "*.ts")'),
      }),
    }
  );

  const replaceInFileTool = tool(
    async ({ filePath, search, replace, dryRun }) => {
      try {
        // Escape special characters for sed
        // Need to escape: / \ & and newlines
        const escapeSed = (text: string): string => {
          return text
            .replace(/\\/g, "\\\\") // Escape backslashes first
            .replace(/\//g, "\\/") // Escape forward slashes
            .replace(/&/g, "\\&") // Escape ampersand
            .replace(/\n/g, "\\n"); // Escape newlines
        };

        const escapedSearch = escapeSed(search);
        const escapedReplace = escapeSed(replace);

        if (dryRun) {
          // Dry run: show diff without making changes
          // First create a temp copy, apply sed, then diff
          const tempFile = `${filePath}.tmp`;

          // Copy original to temp
          await sandbox.commands.run(`cp "${filePath}" "${tempFile}"`);

          // Apply sed to temp file
          await sandbox.commands.run(
            `sed -i 's/${escapedSearch}/${escapedReplace}/g' "${tempFile}"`
          );

          // Get diff
          const diffResult = await sandbox.commands.run(
            `diff -u "${filePath}" "${tempFile}" || true`
          );

          // Clean up temp file
          await sandbox.commands.run(`rm -f "${tempFile}"`);

          console.log(`[TOOL] replaceInFile (dry-run): ${filePath}`);

          if (!diffResult.stdout.trim()) {
            return JSON.stringify({
              changed: false,
              dryRun: true,
              message: "No changes would be made (pattern not found)",
              diff: null,
            });
          }

          return JSON.stringify({
            changed: true,
            dryRun: true,
            message: "Preview of changes (not applied)",
            diff: diffResult.stdout,
          });
        }

        // Actual replacement using sed -i
        const sedCmd = `sed -i 's/${escapedSearch}/${escapedReplace}/g' "${filePath}"`;
        const result = await sandbox.commands.run(sedCmd);

        console.log(
          `[TOOL] replaceInFile: ${filePath} (search="${search}", replace="${replace}")`
        );

        if (result.exitCode !== 0) {
          return JSON.stringify({
            changed: false,
            error: result.stderr || "sed command failed",
            exitCode: result.exitCode,
          });
        }

        return JSON.stringify({
          changed: true,
          file: filePath,
          message: `Replaced all occurrences of "${search}" with "${replace}"`,
        });
      } catch (error) {
        console.error(`[TOOL] replaceInFile ERROR: ${error}`);
        return `Error replacing in file: ${error}`;
      }
    },
    {
      name: "replaceInFile",
      description:
        "Replace text in a specific file using sed. Use searchText first to find files containing the pattern. Supports dry-run mode to preview changes before applying.",
      schema: z.object({
        filePath: z
          .string()
          .describe("Absolute path to the file (e.g., /home/user/src/app.ts)"),
        search: z
          .string()
          .describe("Text pattern to find (literal string, not regex)"),
        replace: z.string().describe("Replacement text"),
        dryRun: z
          .boolean()
          .optional()
          .describe(
            "If true, show diff preview without making changes (default: false)"
          ),
      }),
    }
  );

  const searchAndReplaceTool = tool(
    async ({ pattern, replace, path, filePattern, dryRun }) => {
      try {
        const searchPath = path || "/home/user";
        const globPattern = filePattern || "*";

        // First, find all files with matches using ripgrep
        const excludes = [
          "--glob=!node_modules",
          "--glob=!.next",
          "--glob=!.git",
          "--glob=!dist",
          "--glob=!build",
          "--glob=!.cache",
          "--glob=!*.lock",
        ].join(" ");

        // Get list of files containing the pattern
        const findCmd = `rg -l ${excludes} --glob="${globPattern}" "${pattern}" ${searchPath} 2>/dev/null || true`;
        const findResult = await sandbox.commands.run(findCmd, {
          timeoutMs: 30000,
        });

        if (!findResult.stdout.trim()) {
          return JSON.stringify({
            filesChanged: 0,
            files: [],
            message: "No files contain the search pattern",
          });
        }

        const files = findResult.stdout
          .trim()
          .split("\n")
          .filter((f) => f.trim());
        console.log(
          `[TOOL] searchAndReplace: Found ${files.length} file(s) with pattern "${pattern}"`
        );

        // Escape for sed
        const escapeSed = (text: string): string => {
          return text
            .replace(/\\/g, "\\\\")
            .replace(/\//g, "\\/")
            .replace(/&/g, "\\&")
            .replace(/\n/g, "\\n");
        };

        const escapedSearch = escapeSed(pattern);
        const escapedReplace = escapeSed(replace);

        const results: Array<{
          file: string;
          changed: boolean;
          diff?: string;
        }> = [];

        for (const file of files) {
          if (dryRun) {
            // Dry run: show diff for each file
            const tempFile = `${file}.tmp`;
            await sandbox.commands.run(`cp "${file}" "${tempFile}"`);
            await sandbox.commands.run(
              `sed -i 's/${escapedSearch}/${escapedReplace}/g' "${tempFile}"`
            );
            const diffResult = await sandbox.commands.run(
              `diff -u "${file}" "${tempFile}" || true`
            );
            await sandbox.commands.run(`rm -f "${tempFile}"`);

            results.push({
              file,
              changed: !!diffResult.stdout.trim(),
              diff: diffResult.stdout || undefined,
            });
          } else {
            // Apply changes
            const sedResult = await sandbox.commands.run(
              `sed -i 's/${escapedSearch}/${escapedReplace}/g' "${file}"`
            );
            results.push({
              file,
              changed: sedResult.exitCode === 0,
            });
          }
        }

        const changedCount = results.filter((r) => r.changed).length;

        return JSON.stringify({
          filesChanged: changedCount,
          totalFiles: files.length,
          dryRun: !!dryRun,
          files: results,
          message: dryRun
            ? `Preview: ${changedCount} file(s) would be changed`
            : `Replaced in ${changedCount} file(s)`,
        });
      } catch (error) {
        console.error(`[TOOL] searchAndReplace ERROR: ${error}`);
        return `Error in search and replace: ${error}`;
      }
    },
    {
      name: "searchAndReplace",
      description:
        "Search for a pattern across multiple files and replace all occurrences. Combines searchText + replaceInFile for bulk operations. Use dryRun=true to preview changes first.",
      schema: z.object({
        pattern: z.string().describe("Text pattern to search for"),
        replace: z.string().describe("Replacement text"),
        path: z
          .string()
          .optional()
          .describe("Directory to search in (default: /home/user)"),
        filePattern: z
          .string()
          .optional()
          .describe('Glob pattern to filter files (e.g., "*.tsx")'),
        dryRun: z
          .boolean()
          .optional()
          .describe(
            "If true, show preview without making changes (default: false)"
          ),
      }),
    }
  );

  const getDevLogsTool = tool(
    async ({ lines, filter }) => {
      try {
        const logFile = "/home/user/.logs/dev-server.log";
        const numLines = lines || 100;

        // Check if log file exists
        const checkResult = await sandbox.commands.run(
          `test -f ${logFile} && echo "exists" || echo "not found"`
        );

        if (checkResult.stdout.trim() !== "exists") {
          return JSON.stringify({
            success: false,
            message:
              "Dev server log file not found. The server may not have started yet or logs are not being captured.",
            logs: null,
          });
        }

        // Get the last N lines, optionally filtered
        let cmd = `tail -n ${numLines} ${logFile}`;
        if (filter) {
          // Use grep to filter for specific patterns (errors, warnings, etc.)
          cmd = `tail -n ${numLines * 2} ${logFile} | grep -i "${filter}" | tail -n ${numLines}`;
        }

        const result = await sandbox.commands.run(cmd, { timeoutMs: 10000 });
        console.log(
          `[TOOL] getDevLogs: fetched ${numLines} lines${filter ? ` (filter: ${filter})` : ""}`
        );

        const logContent = result.stdout.trim();

        // Parse logs to extract errors and warnings
        const logLines = logContent.split("\n").filter((l) => l.trim());
        const errors = logLines.filter(
          (l) =>
            l.toLowerCase().includes("error") ||
            l.includes("Error:") ||
            l.includes("ERR!") ||
            l.includes("✗") ||
            l.includes("failed")
        );
        const warnings = logLines.filter(
          (l) =>
            l.toLowerCase().includes("warning") ||
            l.toLowerCase().includes("warn") ||
            l.includes("⚠")
        );

        return JSON.stringify({
          success: true,
          totalLines: logLines.length,
          errorCount: errors.length,
          warningCount: warnings.length,
          errors: errors.slice(-20), // Last 20 errors
          warnings: warnings.slice(-10), // Last 10 warnings
          recentLogs: logLines.slice(-50), // Last 50 lines of full logs
          message:
            errors.length > 0
              ? `Found ${errors.length} error(s) in logs`
              : "No errors found in recent logs",
        });
      } catch (error) {
        console.error(`[TOOL] getDevLogs ERROR: ${error}`);
        return JSON.stringify({
          success: false,
          message: `Error reading logs: ${error}`,
          logs: null,
        });
      }
    },
    {
      name: "getDevLogs",
      description:
        "Read the dev server logs to check for errors, warnings, or runtime issues. Use this to diagnose why something isn't working or to see build/compilation errors. ALWAYS check logs when the user reports an error or something not working.",
      schema: z.object({
        lines: z
          .number()
          .optional()
          .describe("Number of log lines to fetch (default: 100)"),
        filter: z
          .string()
          .optional()
          .describe(
            'Optional filter to search for specific terms (e.g., "error", "warning", "TypeError")'
          ),
      }),
    }
  );

  return [
    createFileTool,
    updateFileTool,
    deleteFileTool,
    readFileTool,
    listFilesTool,
    runCommandTool,
    getThemeInfoTool,
    getThemeTool,
    searchTextTool,
    replaceInFileTool,
    searchAndReplaceTool,
    getDevLogsTool,
  ];
}

export const toolDefinitions = {
  createFile: {
    name: "createFile",
    description:
      "Create a NEW file that doesn't exist yet at a certain directory path",
  },
  updateFile: {
    name: "updateFile",
    description: "Update an EXISTING file at a certain directory path",
  },
  deleteFile: {
    name: "deleteFile",
    description: "Delete a file at a certain directory path",
  },
  readFile: {
    name: "readFile",
    description: "Read the contents of a file at a certain directory path",
  },
  listFiles: {
    name: "listFiles",
    description: "List all files in a directory to see what exists",
  },
  runCommand: {
    name: "runCommand",
    description: "Run a terminal command in the sandbox environment",
  },
  getThemeInfo: {
    name: "getThemeInfo",
    description:
      "Get list of available pre-built shadcn themes with descriptions and use cases",
  },
  getTheme: {
    name: "getTheme",
    description:
      "Get the CSS content for a specific theme to apply to globals.css",
  },
  searchText: {
    name: "searchText",
    description:
      "Search for text or regex pattern in project files using ripgrep. Returns file paths and line numbers.",
  },
  replaceInFile: {
    name: "replaceInFile",
    description:
      "Replace text in a specific file using sed. Supports dry-run mode for preview.",
  },
  searchAndReplace: {
    name: "searchAndReplace",
    description:
      "Search and replace text across multiple files. Combines search + replace for bulk operations.",
  },
  getDevLogs: {
    name: "getDevLogs",
    description:
      "Read the dev server logs to check for errors, warnings, or runtime issues. Use this to diagnose problems.",
  },
};
