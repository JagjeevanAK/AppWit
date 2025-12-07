import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { Sandbox } from "e2b";
import { getThemeList, getThemeCSS, type ThemeInfo } from "../data/themes";

export function createSandboxTools(sandbox: Sandbox) {
    const createFileTool = tool(
        async ({ location, content }) => {
            try {
                const dir = location.substring(0, location.lastIndexOf('/'));
                if (dir) {
                    await sandbox.commands.run(`mkdir -p ${dir}`);
                }
                await sandbox.files.write(location, content || '');
                console.log(`[TOOL] createFile: ${location}`);
                return `File created successfully at ${location}`;
            } catch (error) {
                console.error(`[TOOL] createFile ERROR: ${error}`);
                return `Error creating file: ${error}`;
            }
        },
        {
            name: "createFile",
            description: "Create a NEW file that doesn't exist yet. This will also create parent directories if needed.",
            schema: z.object({
                location: z.string().describe('Absolute path to the file (e.g., /home/user/src/components/Button.tsx)'),
                content: z.string().describe('Complete content of the file')
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
            description: "Update an EXISTING file. Use this to modify files like App.tsx, App.css that already exist.",
            schema: z.object({
                location: z.string().describe('Absolute path to the file to update'),
                content: z.string().describe('Complete new content of the file'),
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
                location: z.string().describe('Absolute path to the file to delete'),
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
                location: z.string().describe('Absolute path to the file to read'),
            }),
        }
    );

    const listFilesTool = tool(
        async ({ path }) => {
            try {
                const files = await sandbox.files.list(path);
                console.log(`[TOOL] listFiles: ${path}`);
                return `Files in ${path}:\n${files.map(f => `- ${f.name}${f.type === 'dir' ? '/' : ''}`).join('\n')}`;
            } catch (error) {
                console.error(`[TOOL] listFiles ERROR: ${error}`);
                return `Error listing files: ${error}`;
            }
        },
        {
            name: "listFiles",
            description: "List all files in a directory",
            schema: z.object({
                path: z.string().default('/home/user').describe('Directory path to list files from'),
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
                command: z.string().describe('The command to run in the terminal'),
            }),
        }
    );

    const getThemeInfoTool = tool(
        async () => {
            try {
                const themeList = getThemeList();
                console.log(`[TOOL] getThemeInfo: listing ${themeList.length} themes`);

                const formattedList = themeList.map((theme: ThemeInfo) =>
                    `- **${theme.name}** (${theme.name.toLowerCase().replace(/\s+/g, '-')}): ${theme.description}\n  Best for: ${theme.bestFor.join(', ')}`
                ).join('\n\n');

                return `Available shadcn themes:\n\n${formattedList}\n\nUSAGE: Call getTheme with the theme name to get the CSS content, then paste it into /home/user/src/index.css`;
            } catch (error) {
                console.error(`[TOOL] getThemeInfo ERROR: ${error}`);
                return `Error getting theme info: ${error}`;
            }
        },
        {
            name: "getThemeInfo",
            description: "Get a list of all available pre-built shadcn themes with descriptions. Use this FIRST to choose the right theme for the project, then call getTheme to get the CSS.",
            schema: z.object({}),
        }
    );

    const getThemeTool = tool(
        async ({ themeName }) => {
            try {
                const css = getThemeCSS(themeName);
                if (!css) {
                    const availableThemes = getThemeList().map(t => t.name.toLowerCase().replace(/\s+/g, '-')).join(', ');
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
            description: "Get the CSS content for a specific theme. Use this to download a theme, then paste the entire CSS into /home/user/src/index.css to apply it. ALWAYS add '@import \"tailwindcss\";' at the TOP of index.css before the theme CSS.",
            schema: z.object({
                themeName: z.string().describe('Theme name (e.g., "vercel", "darkmatter", "twitter", "caffeine", "claymorphism", "graphite", "mocha-mousse", "elegant-luxury", "sage-garden", "amethyst-haze")'),
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
        getThemeTool
    ];
}

export const toolDefinitions = {
    createFile: {
        name: "createFile",
        description: "Create a NEW file that doesn't exist yet at a certain directory path",
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
        description: "Get list of available pre-built shadcn themes with descriptions and use cases",
    },
    getTheme: {
        name: "getTheme",
        description: "Get the CSS content for a specific theme to apply to index.css",
    },
};
