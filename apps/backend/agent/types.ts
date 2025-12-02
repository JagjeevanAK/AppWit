import { z } from "zod";

export const TaskSchema = z.object({
    id: z.number(),
    file: z.string(),
    action: z.enum(["create", "update", "delete"]),
    description: z.string(),
});

export const PlanSchema = z.object({
    summary: z.string(),
    tasks: z.array(TaskSchema),
});

export const ReviewResultSchema = z.object({
    status: z.enum(["success", "issues"]),
    message: z.string().optional(),
    problems: z.array(z.string()).optional(),
    suggestions: z.array(z.string()).optional(),
});

export type Task = z.infer<typeof TaskSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

export interface WorkerResult {
    taskId: number;
    file: string;
    success: boolean;
    message: string;
}

export interface OrchestratorState {
    userPrompt: string;
    plan: Plan | null;
    workerResults: WorkerResult[];
    reviewResult: ReviewResult | null;
    finalResponse: string;
}
