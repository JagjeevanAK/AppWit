// Planner node - analyzes requests and creates task lists

import type { Sandbox } from "e2b";
import {
    HumanMessage,
    SystemMessage,
} from "@langchain/core/messages";
import { PLANNER_SYSTEM_PROMPT } from "../systemPrompts";
import { ExtendedPlanSchema } from "../types";
import type { Plan, ExtendedPlan } from "../types";
import { createLLM } from "../llmFactory";
import { createSandboxTools } from "../tools";
import { log, type GraphStateType, type StreamConfig } from "./types";

const DEBUG_KEYWORDS =
    /\b(error|not working|broken|fix|bug|issue|failed|crash|problem|wrong|doesn't work)\b/i;
const MAX_TOOL_CALL_ROUNDS = 3;

async function collectDevLogsWithTool(
    prompt: string,
    sandbox: Sandbox,
    streamConfig?: StreamConfig
): Promise<string | null> {
    if (!DEBUG_KEYWORDS.test(prompt)) {
        return null;
    }

    const getDevLogsTool = createSandboxTools(sandbox).find(
        (tool) => tool.name === "getDevLogs"
    );

    if (!getDevLogsTool) {
        log.planner("getDevLogs tool unavailable, continuing without tool diagnostics");
        return null;
    }

    const toolModel = (createLLM() as any).bindTools([getDevLogsTool as any]);
    const messages: any[] = [
        new SystemMessage(
            "You are diagnosing a Next.js project issue. Use getDevLogs to inspect errors before planning. " +
            "Call the tool when useful, then provide a concise diagnosis."
        ),
        new HumanMessage(prompt),
    ];

    const collectedToolOutputs: string[] = [];

    for (let round = 1; round <= MAX_TOOL_CALL_ROUNDS; round++) {
        const response = await toolModel.invoke(messages);
        messages.push(response);

        const toolCalls = (response as any)?.tool_calls as
            | Array<{ id?: string; name?: string; args?: unknown }>
            | undefined;

        if (!toolCalls?.length) {
            break;
        }

        for (let idx = 0; idx < toolCalls.length; idx++) {
            const call = toolCalls[idx];
            if (!call || call.name !== "getDevLogs") {
                continue;
            }

            streamConfig?.configurable?.streamCallback?.({
                type: "executing",
                message: "Planner is checking dev server logs...",
            });

            let toolOutput = "";
            try {
                const result = await (getDevLogsTool as any).invoke(
                    (call.args as Record<string, unknown> | undefined) || {}
                );
                toolOutput =
                    typeof result === "string" ? result : JSON.stringify(result);
            } catch (toolError) {
                toolOutput = JSON.stringify({
                    success: false,
                    message:
                        toolError instanceof Error
                            ? toolError.message
                            : String(toolError),
                });
            }

            collectedToolOutputs.push(toolOutput);

            messages.push({
                role: "tool",
                tool_call_id: call.id || `getDevLogs-${round}-${idx}`,
                content: toolOutput,
            });
        }
    }

    if (collectedToolOutputs.length === 0) {
        return null;
    }

    return collectedToolOutputs.join("\n\n");
}

async function runPlanner(
    state: GraphStateType,
    config?: StreamConfig,
    sandbox?: Sandbox
): Promise<Partial<GraphStateType>> {
    log.planner('Analyzing request and creating plan...');
    log.planner('Prompt:', state.prompt.slice(0, 100) + (state.prompt.length > 100 ? '...' : ''));

    config?.configurable?.streamCallback?.({
        type: 'planning',
        message: 'Analyzing your request...'
    });

    const startTime = Date.now();
    const structuredModel = createLLM().withStructuredOutput(ExtendedPlanSchema);
    let planningPrompt = state.prompt;

    let plan: ExtendedPlan;
    try {
        if (sandbox) {
            const toolDiagnostics = await collectDevLogsWithTool(
                state.prompt,
                sandbox,
                config
            );
            if (toolDiagnostics) {
                planningPrompt =
                    `${state.prompt}\n\n` +
                    `DIAGNOSTIC CONTEXT FROM getDevLogs TOOL:\n` +
                    `${toolDiagnostics}\n\n` +
                    `Use this context to identify and fix the root cause.`;
            }
        }

        plan = await structuredModel.invoke([
            new SystemMessage(PLANNER_SYSTEM_PROMPT),
            new HumanMessage(planningPrompt)
        ]);
    } catch (error) {
        log.planner('Planning failed:', error);
        // Fallback to frontend-only if planning fails
        config?.configurable?.streamCallback?.({
            type: 'plan_complete',
            message: 'Using default plan (planning failed)',
        });
        return {
            plan: {
                summary: "Generating code based on request",
                tasks: [{
                    id: 1,
                    file: "/home/user/app/page.tsx",
                    action: "update" as const,
                    description: state.prompt
                }]
            },
            projectType: 'frontend-only'
        };
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log.planner(`Created plan with ${plan.tasks.length} tasks in ${duration}s`);
    log.planner(`Project type: ${plan.projectType}`);
    log.planner(`Requires backend: ${plan.requiresBackend}`);
    log.planner(`Recommended theme: ${plan.recommendedTheme} (${plan.themeReason})`);
    plan.tasks.forEach(t => log.planner(`  Task ${t.id}: ${t.action} ${t.file}`));

    const planForState: Plan = {
        summary: plan.summary,
        tasks: plan.tasks
    };

    config?.configurable?.streamCallback?.({
        type: 'plan_complete',
        message: `Plan created: ${plan.tasks.length} files to ${plan.projectType === 'update' ? 'update' : 'generate'}`,
        plan: planForState
    });

    return {
        plan: planForState,
        projectType: plan.projectType,
        theme: plan.recommendedTheme  // Pass recommended theme directly to themeApplicator
    };
}

export async function plannerNode(
    state: GraphStateType,
    config?: StreamConfig
): Promise<Partial<GraphStateType>> {
    return runPlanner(state, config);
}

export function createPlannerNode(sandbox: Sandbox) {
    return async (
        state: GraphStateType,
        config?: StreamConfig
    ): Promise<Partial<GraphStateType>> => runPlanner(state, config, sandbox);
}
