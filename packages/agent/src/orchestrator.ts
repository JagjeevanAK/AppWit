/**
 * MODULE: Agent Orchestrator - LangGraph State Machine
 * 
 * This module defines the core code generation pipeline using LangGraph's StateGraph.
 * It orchestrates multiple specialized nodes in a directed graph to transform a user
 * prompt into generated code files.
 * 
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │                          LangGraph State Machine                            │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 *   START
 *     │
 *     ▼
 * ┌─────────┐    Analyzes prompt, creates task list
 * │ planner │    Output: Plan with file tasks
 * └────┬────┘
 *      │
 *      ▼
 * ┌─────────┐    Generates code for each task
 * │ codegen │    Uses batch processing for large plans
 * └────┬────┘
 *      │
 *      ▼
 * ┌───────────────┐    Applies theme colors/variables
 * │themeApplicator│    if theme is specified in output
 * └───────┬───────┘
 *         │
 *         ▼
 * ┌──────────────┐    Runs npm commands (install deps)
 * │commandHandler│    in the E2B sandbox
 * └───────┬──────┘
 *         │
 *         ▼
 * ┌────────┐    Writes files to E2B sandbox filesystem
 * │ writer │    Creates directories as needed
 * └────┬───┘
 *      │
 *      ▼
 * ┌──────────┐    Validates all planned files exist
 * │ reviewer │────────┐
 * └────┬─────┘        │
 *      │              │ (if issues found && retryCount < 1)
 *      │              │ Loop back to codegen
 *      ▼              │
 *     END ◄───────────┘
 * 
 * 
 * STREAMING EVENTS:
 * The `streamOrchestrator` emits events during execution:
 * - 'planning'       → Initial analysis phase
 * - 'plan_complete'  → Plan created with task list
 * - 'generating'     → Code generation in progress
 * - 'executing'      → Running shell commands
 * - 'file_created'   → File written to sandbox
 * - 'review_complete'→ Validation finished
 * - 'retrying'       → Regenerating missing files
 * - 'done'           → Pipeline complete
 * - 'error'          → Fatal error occurred
 * 
 * 
 * PROGRESSIVE FILE WRITING:
 * Files are written to the sandbox as they're generated (not at the end).
 * This allows the frontend to show progress and enables the dev server
 * to hot-reload during generation.
 */

// Main orchestrator - sets up the graph and exports run/stream functions

import { StateGraph, START, END } from "@langchain/langgraph";
import type { Sandbox } from "e2b";
import { INITIAL_SYSTEM_PROMPT } from "./systemPrompts";
import type { FileContent, Plan, ReviewResult } from "./types";

// Import all nodes from modular files
import {
    GraphState,
    type StreamEvent,
    log,
    plannerNode,
    coderNode,
    createThemeApplicatorNode,
    createCommandHandlerNode,
    createWriterNode,
    createReviewerNode,
    shouldRetry
} from "./nodes";

// Import Langfuse observability
import {
    createTrace,
    flushLangfuse,
    isLangfuseEnabled,
    runEvals,
    type LangfuseTrace,
} from "./observability";

// Re-export StreamEvent for external use
export type { StreamEvent };

function createGraph(sandbox: Sandbox) {
    const themeApplicator = createThemeApplicatorNode(sandbox);
    const commandHandler = createCommandHandlerNode(sandbox);
    const writer = createWriterNode(sandbox);
    const reviewer = createReviewerNode(sandbox);

    const graph = new StateGraph(GraphState)
        // Nodes
        .addNode("planner", plannerNode)
        .addNode("codegen", coderNode)
        .addNode("themeApplicator", themeApplicator)
        .addNode("commandHandler", commandHandler)
        .addNode("writer", writer)
        .addNode("reviewer", reviewer)
        // Edges - flow with planner and reviewer
        .addEdge(START, "planner")
        .addEdge("planner", "codegen")
        .addEdge("codegen", "themeApplicator")
        .addEdge("themeApplicator", "commandHandler")
        .addEdge("commandHandler", "writer")
        .addEdge("writer", "reviewer")
        // Conditional edge for retry logic
        .addConditionalEdges("reviewer", shouldRetry, {
            "codegen": "codegen",
            "__end__": END
        });

    return graph.compile();
}

export async function runOrchestrator(
    sandbox: Sandbox,
    prompt: string,
    systemPrompt: string = INITIAL_SYSTEM_PROMPT
): Promise<{ files: FileContent[]; writtenFiles: string[] }> {
    log.orchestrator('Starting code generation');

    const graph = createGraph(sandbox);
    const result = await graph.invoke({
        prompt,
        systemPrompt,
        files: [],
        commands: [],
        writtenFiles: []
    });

    log.orchestrator('Code generation complete');
    return {
        files: result.files || [],
        writtenFiles: result.writtenFiles || []
    };
}

export async function* streamOrchestrator(
    sandbox: Sandbox,
    prompt: string,
    systemPrompt: string = INITIAL_SYSTEM_PROMPT,
    options?: { userId?: string; sessionId?: string }
): AsyncGenerator<StreamEvent> {
    log.orchestrator('Starting code generation (streaming)');

    const graph = createGraph(sandbox);
    const startTime = Date.now();

    // Create Langfuse trace for this pipeline execution
    const trace = createTrace({
        name: "code-generation-pipeline",
        userId: options?.userId,
        sessionId: options?.sessionId,
        metadata: {
            promptLength: prompt.length,
            hasSystemPrompt: !!systemPrompt,
        },
        tags: ["pipeline", "codegen"],
    });

    // Create a write function for progressive file writing during codegen
    const writeFilesToSandbox = async (files: FileContent[]): Promise<string[]> => {
        const writtenPaths: string[] = [];
        for (const file of files) {
            try {
                // Create directory if needed
                const dir = file.filePath.substring(0, file.filePath.lastIndexOf('/'));
                if (dir) {
                    await sandbox.commands.run(`mkdir -p ${dir}`);
                }
                // Write file
                await sandbox.files.write(file.filePath, file.content);
                writtenPaths.push(file.filePath);
                log.orchestrator(`[PROGRESSIVE] Written: ${file.filePath}`);
            } catch (error) {
                log.orchestrator(`[PROGRESSIVE] Failed to write ${file.filePath}:`, error);
            }
        }
        return writtenPaths;
    };

    yield { type: 'planning', message: 'Analyzing your request...' };

    // Track state for evals
    let capturedPlan: Plan | null = null;
    let capturedFiles: FileContent[] = [];

    try {
        const stream = graph.streamEvents(
            { prompt, systemPrompt, files: [], commands: [], writtenFiles: [] },
            {
                version: "v2",
                configurable: {
                    writeFiles: writeFilesToSandbox
                }
            }
        );

        let files: FileContent[] = [];
        const emittedWriteCompletes = new Set<string>();

        for await (const event of stream) {
            if (event.event === "on_chain_end") {
                // Planner completed
                if (event.name === "planner" && event.data?.output?.plan) {
                    const plan = event.data.output.plan as Plan;
                    capturedPlan = plan; // Capture for evals

                    // Create a span for the planner node
                    if (trace) {
                        const plannerSpan = trace.createSpan({
                            name: "planner",
                            input: { prompt: prompt.slice(0, 500) },
                            metadata: { taskCount: plan.tasks.length },
                        });
                        plannerSpan.end({ output: plan });
                    }

                    yield {
                        type: 'plan_complete',
                        message: `Plan created: ${plan.tasks.length} files to generate`,
                        plan
                    };
                }

                // Codegen completed
                if (event.name === "codegen" && event.data?.output?.files) {
                    files = event.data.output.files as FileContent[];
                    capturedFiles = files; // Capture for evals
                    const commands = (event.data.output.commands || []) as string[];

                    // Create a span for the codegen node
                    if (trace) {
                        const codegenSpan = trace.createSpan({
                            name: "codegen",
                            input: { plan: capturedPlan },
                            metadata: { fileCount: files.length, commandCount: commands.length },
                        });
                        codegenSpan.end({ output: { fileCount: files.length, commandCount: commands.length } });
                    }

                    yield { type: 'generating', message: `Generated ${files.length} files, ${commands.length} commands` };

                    // Emit command execution events
                    for (const cmd of commands) {
                        yield { type: 'executing', message: `Running: ${cmd}` };
                    }
                }

                // Writer completed
                if (event.name === "writer" && event.data?.output?.writtenFiles) {
                    const written = event.data.output.writtenFiles as string[];
                    for (const filePath of written) {
                        if (!emittedWriteCompletes.has(filePath)) {
                            emittedWriteCompletes.add(filePath);
                            yield { type: 'file_created', filePath, message: `Created ${filePath}` };
                        }
                    }
                }

                // Reviewer completed
                if (event.name === "reviewer" && event.data?.output?.reviewResult) {
                    const result = event.data.output.reviewResult as ReviewResult;

                    // Create a span for the reviewer node
                    if (trace) {
                        const reviewerSpan = trace.createSpan({
                            name: "reviewer",
                            input: { fileCount: capturedFiles.length },
                            metadata: { status: result.status },
                        });
                        reviewerSpan.end({
                            output: result,
                            level: result.status === 'success' ? 'DEFAULT' : 'WARNING',
                        });
                    }

                    yield {
                        type: 'review_complete',
                        message: result.status === 'success'
                            ? 'All tasks completed'
                            : `Issues found: ${result.problems?.length || 0}`,
                        reviewResult: result
                    };

                    // If retrying, emit retrying event
                    if (result.status === 'issues' && event.data?.output?.retryCount === 1) {
                        yield { type: 'retrying', message: 'Regenerating missing files...' };
                    }
                }
            }
        }

        const generationTimeMs = Date.now() - startTime;
        log.orchestrator(`Code generation complete in ${(generationTimeMs / 1000).toFixed(1)}s`);

        // Run LLM-as-Judge evaluations if Langfuse is enabled
        if (trace && isLangfuseEnabled()) {
            try {
                await runEvals(trace, {
                    userPrompt: prompt,
                    plan: capturedPlan,
                    files: capturedFiles,
                    generationTimeMs,
                });
            } catch (evalError) {
                log.orchestrator('Evals failed (non-fatal):', evalError);
            }

            // End the trace with final output
            trace.end({
                filesGenerated: capturedFiles.length,
                generationTimeMs,
                success: true,
            });
        }

        yield { type: 'done', message: 'Code generation complete' };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.orchestrator(`Error: ${errorMessage}`);

        // Log error to trace if available
        if (trace) {
            trace.score({
                name: "pipelineError",
                value: 0,
                comment: errorMessage,
            });
            trace.end({ error: errorMessage, success: false });
        }

        yield { type: 'error', message: errorMessage };
    } finally {
        // Flush Langfuse events
        await flushLangfuse();
    }
}

// Legacy aliases for backward compatibility
export const streamMultiAgentOrchestrator = streamOrchestrator;
export const runMultiAgentOrchestrator = runOrchestrator;
