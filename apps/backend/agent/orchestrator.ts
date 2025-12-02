import { createAgent, toolCallLimitMiddleware } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { Sandbox } from "e2b";
import { createSandboxTools } from "../tools";
import { PLANNER_PROMPT, WORKER_PROMPT, REVIEWER_PROMPT } from "./prompts";
import { PlanSchema, ReviewResultSchema } from "./types";
import type { Plan, Task, WorkerResult, ReviewResult } from "./types";

const MAX_WORKERS = 4;
const WORKER_TOOL_LIMIT = 10;

const createModel = (temperature = 0) => {
    return new ChatOpenAI({
        model: "anthropic/claude-sonnet-4",
        temperature,
        configuration: {
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: process.env.OPENROUTER_API_KEY,
        },
    });
};

async function runPlannerAgent(userPrompt: string): Promise<Plan> {
    const model = createModel();
    
    const response = await model.invoke([
        new SystemMessage(PLANNER_PROMPT),
        new HumanMessage(userPrompt)
    ]);

    const content = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error("Planner did not return valid JSON");
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    return PlanSchema.parse(parsed);
}

function createWorkerAgent(sandbox: Sandbox, task: Task) {
    const tools = createSandboxTools(sandbox);
    const model = createModel();
    
    const taskPrompt = `${WORKER_PROMPT}

YOUR ASSIGNED TASK:
- File: ${task.file}
- Action: ${task.action}
- Description: ${task.description}

Complete this task now.`;

    return createAgent({
        model,
        tools,
        systemPrompt: taskPrompt,
        middleware: [
            toolCallLimitMiddleware({ runLimit: WORKER_TOOL_LIMIT })
        ]
    });
}

async function runWorkerAgent(
    sandbox: Sandbox, 
    task: Task,
    onProgress?: (event: WorkerEvent) => void
): Promise<WorkerResult> {
    const agent = createWorkerAgent(sandbox, task);
    
    try {
        onProgress?.({
            type: 'worker_start',
            taskId: task.id,
            file: task.file
        });

        const result = await agent.invoke({
            messages: [new HumanMessage(`Implement the task for ${task.file}: ${task.description}`)]
        });

        const lastMessage = result.messages[result.messages.length - 1];
        const content = lastMessage 
            ? (typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content))
            : 'Task completed';

        onProgress?.({
            type: 'worker_complete',
            taskId: task.id,
            file: task.file,
            success: true
        });

        return {
            taskId: task.id,
            file: task.file,
            success: true,
            message: content
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        onProgress?.({
            type: 'worker_complete',
            taskId: task.id,
            file: task.file,
            success: false,
            error: errorMessage
        });

        return {
            taskId: task.id,
            file: task.file,
            success: false,
            message: `Error: ${errorMessage}`
        };
    }
}

async function runReviewerAgent(
    sandbox: Sandbox, 
    plan: Plan, 
    workerResults: WorkerResult[]
): Promise<ReviewResult> {
    const tools = createSandboxTools(sandbox).filter(t => 
        ['readFile', 'listFiles'].includes(t.name)
    );
    const model = createModel();

    const reviewContext = `
Files that were modified:
${plan.tasks.map(t => `- ${t.file} (${t.action}): ${t.description}`).join('\n')}

Worker Results:
${workerResults.map(r => `- Task ${r.taskId} (${r.file}): ${r.success ? 'Success' : 'Failed'} - ${r.message.slice(0, 200)}`).join('\n')}

Please review all the files and verify they work together correctly.`;

    const agent = createAgent({
        model,
        tools,
        systemPrompt: REVIEWER_PROMPT,
        middleware: [
            toolCallLimitMiddleware({ runLimit: 10 })
        ]
    });

    const result = await agent.invoke({
        messages: [new HumanMessage(reviewContext)]
    });

    const lastMessage = result.messages[result.messages.length - 1];
    const content = lastMessage
        ? (typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content))
        : '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        return {
            status: 'success',
            message: content
        };
    }

    try {
        const parsed = JSON.parse(jsonMatch[0]);
        return ReviewResultSchema.parse(parsed);
    } catch {
        return {
            status: 'success',
            message: content
        };
    }
}

export interface WorkerEvent {
    type: 'plan' | 'worker_start' | 'worker_complete' | 'review_start' | 'review_complete' | 'done';
    taskId?: number;
    file?: string;
    success?: boolean;
    error?: string;
    plan?: Plan;
    review?: ReviewResult;
}

export interface OrchestratorOptions {
    maxWorkers?: number;
    onProgress?: (event: WorkerEvent) => void;
}

export async function runMultiAgentOrchestrator(
    sandbox: Sandbox,
    userPrompt: string,
    options: OrchestratorOptions = {}
): Promise<{
    plan: Plan;
    workerResults: WorkerResult[];
    review: ReviewResult;
}> {
    const { maxWorkers = MAX_WORKERS, onProgress } = options;

    const plan = await runPlannerAgent(userPrompt);
    onProgress?.({ type: 'plan', plan });

    const tasksToRun = plan.tasks.slice(0, maxWorkers);
    
    const workerPromises = tasksToRun.map(task => 
        runWorkerAgent(sandbox, task, onProgress)
    );
    
    const workerResults = await Promise.all(workerPromises);

    onProgress?.({ type: 'review_start' });
    const review = await runReviewerAgent(sandbox, plan, workerResults);
    onProgress?.({ type: 'review_complete', review });

    onProgress?.({ type: 'done' });

    return {
        plan,
        workerResults,
        review
    };
}

export async function* streamMultiAgentOrchestrator(
    sandbox: Sandbox,
    userPrompt: string,
    options: OrchestratorOptions = {}
): AsyncGenerator<WorkerEvent> {
    const { maxWorkers = MAX_WORKERS } = options;

    yield { type: 'plan' as const };
    const plan = await runPlannerAgent(userPrompt);
    yield { type: 'plan' as const, plan };

    const tasksToRun = plan.tasks.slice(0, maxWorkers);
    
    for (const task of tasksToRun) {
        yield { type: 'worker_start' as const, taskId: task.id, file: task.file };
    }

    const workerPromises = tasksToRun.map(task => 
        runWorkerAgent(sandbox, task)
    );
    
    const workerResults = await Promise.all(workerPromises);
    
    for (const result of workerResults) {
        yield { 
            type: 'worker_complete' as const, 
            taskId: result.taskId, 
            file: result.file,
            success: result.success,
            error: result.success ? undefined : result.message
        };
    }

    yield { type: 'review_start' as const };
    const review = await runReviewerAgent(sandbox, plan, workerResults);
    yield { type: 'review_complete' as const, review };

    yield { type: 'done' as const };
}

export { createAgentGraph, type AgentGraph, streamAgentResponse, runAgent } from "./graph";
