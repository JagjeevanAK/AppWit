/**
 * MODULE: LLM-as-Judge Evaluations
 *
 * Defines evaluation criteria using LLM as a judge to assess the quality
 * of generated code and plans. Scores are attached to Langfuse traces.
 *
 * Available Evals:
 *   - codeQualityEval: Best practices, readability, maintainability
 *   - planRelevanceEval: How well the plan addresses user's request
 *   - codeCorrectnessEval: Whether code matches the plan
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { createLLM } from "../llmFactory";
import type { LangfuseTrace } from "./langfuse";
import type { Plan, FileContent } from "../types";

// Schema for eval results
const EvalResultSchema = z.object({
    score: z
        .number()
        .min(0)
        .max(1)
        .describe("Score between 0 and 1, where 1 is best"),
    reasoning: z.string().describe("Brief explanation for the score"),
});

type EvalResult = z.infer<typeof EvalResultSchema>;

/**
 * Base interface for all evaluations
 */
interface EvalDefinition {
    name: string;
    systemPrompt: string;
    buildUserPrompt: (context: EvalContext) => string;
}

/**
 * Context passed to evaluation functions
 */
export interface EvalContext {
    userPrompt: string;
    plan?: Plan | null;
    files?: FileContent[];
    generationTimeMs?: number;
}

// ============================================================================
// EVAL DEFINITIONS
// ============================================================================

/**
 * Evaluates generated code for best practices, readability, and maintainability
 */
const codeQualityEval: EvalDefinition = {
    name: "codeQuality",
    systemPrompt: `You are an expert code reviewer. Evaluate the provided code for:
- Code quality and best practices
- Readability and maintainability
- Proper error handling
- Type safety (for TypeScript)
- Performance considerations

Rate the code from 0 to 1 where:
- 0.0-0.3: Poor quality, many issues
- 0.4-0.6: Acceptable, some improvements needed
- 0.7-0.8: Good quality, minor issues
- 0.9-1.0: Excellent, production-ready

Be concise in your reasoning.`,

    buildUserPrompt: (ctx: EvalContext) => {
        const filesContent =
            ctx.files
                ?.map((f) => `### ${f.filePath}\n\`\`\`\n${f.content}\n\`\`\``)
                .join("\n\n") || "No files provided";

        return `User Request: ${ctx.userPrompt}

Generated Files:
${filesContent}

Evaluate the code quality.`;
    },
};

/**
 * Evaluates how well the plan addresses the user's request
 */
const planRelevanceEval: EvalDefinition = {
    name: "planRelevance",
    systemPrompt: `You are an expert software architect. Evaluate whether the generated plan correctly addresses the user's request.

Consider:
- Does the plan cover all aspects of the request?
- Are the chosen files and actions appropriate?
- Is the plan complete or missing key components?
- Is the project type (frontend-only, full-stack, etc.) correct?

Rate from 0 to 1 where:
- 0.0-0.3: Plan misses the point or is fundamentally wrong
- 0.4-0.6: Plan addresses some aspects but has gaps
- 0.7-0.8: Good plan with minor omissions
- 0.9-1.0: Comprehensive and well-structured plan

Be concise in your reasoning.`,

    buildUserPrompt: (ctx: EvalContext) => {
        const planSummary = ctx.plan
            ? `Summary: ${ctx.plan.summary}\nTasks:\n${ctx.plan.tasks.map((t) => `- ${t.action} ${t.file}: ${t.description}`).join("\n")}`
            : "No plan provided";

        return `User Request: ${ctx.userPrompt}

Generated Plan:
${planSummary}

Evaluate the plan relevance.`;
    },
};

/**
 * Evaluates whether the generated code correctly implements the plan
 */
const codeCorrectnessEval: EvalDefinition = {
    name: "codeCorrectness",
    systemPrompt: `You are an expert code reviewer. Evaluate whether the generated code correctly implements the planned tasks.

Consider:
- Does the code match what was described in the plan?
- Are all planned files created/modified correctly?
- Does the code fulfill the user's original request?
- Are there any logical errors or missing implementations?

Rate from 0 to 1 where:
- 0.0-0.3: Code doesn't match plan or has major issues
- 0.4-0.6: Partial implementation with notable gaps
- 0.7-0.8: Good implementation with minor deviations
- 0.9-1.0: Perfect implementation of the plan

Be concise in your reasoning.`,

    buildUserPrompt: (ctx: EvalContext) => {
        const planSummary = ctx.plan
            ? `Summary: ${ctx.plan.summary}\nTasks:\n${ctx.plan.tasks.map((t) => `- ${t.action} ${t.file}: ${t.description}`).join("\n")}`
            : "No plan provided";

        const filesContent =
            ctx.files
                ?.slice(0, 5) // Limit to first 5 files to avoid token limits
                .map((f) => `### ${f.filePath}\n\`\`\`\n${f.content.slice(0, 2000)}\n\`\`\``)
                .join("\n\n") || "No files provided";

        return `User Request: ${ctx.userPrompt}

Plan:
${planSummary}

Generated Files (first 5, truncated):
${filesContent}

Evaluate if the code correctly implements the plan.`;
    },
};

// ============================================================================
// EVAL RUNNER
// ============================================================================

/**
 * Run a single evaluation and return the result
 */
async function runSingleEval(
    evalDef: EvalDefinition,
    context: EvalContext
): Promise<EvalResult> {
    const llm = createLLM().withStructuredOutput(EvalResultSchema);

    try {
        const result = await llm.invoke([
            new SystemMessage(evalDef.systemPrompt),
            new HumanMessage(evalDef.buildUserPrompt(context)),
        ]);
        return result;
    } catch (error) {
        console.error(`\x1b[31m[EVALS]\x1b[0m ${evalDef.name} failed:`, error);
        return {
            score: 0.5,
            reasoning: `Evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
    }
}

/**
 * Run all evaluations and attach scores to the trace
 */
export async function runEvals(
    trace: LangfuseTrace,
    context: EvalContext,
    options?: {
        runCodeQuality?: boolean;
        runPlanRelevance?: boolean;
        runCodeCorrectness?: boolean;
    }
): Promise<void> {
    const {
        runCodeQuality = true,
        runPlanRelevance = true,
        runCodeCorrectness = true,
    } = options || {};

    console.log("\x1b[35m[EVALS]\x1b[0m Running LLM-as-Judge evaluations...");

    const evalPromises: Promise<void>[] = [];

    // Plan relevance eval (if plan exists)
    if (runPlanRelevance && context.plan) {
        evalPromises.push(
            runSingleEval(planRelevanceEval, context).then((result) => {
                trace.score({
                    name: planRelevanceEval.name,
                    value: result.score,
                    comment: result.reasoning,
                });
                console.log(
                    `\x1b[35m[EVALS]\x1b[0m ${planRelevanceEval.name}: ${result.score.toFixed(2)} - ${result.reasoning.slice(0, 50)}...`
                );
            })
        );
    }

    // Code quality eval (if files exist)
    if (runCodeQuality && context.files && context.files.length > 0) {
        evalPromises.push(
            runSingleEval(codeQualityEval, context).then((result) => {
                trace.score({
                    name: codeQualityEval.name,
                    value: result.score,
                    comment: result.reasoning,
                });
                console.log(
                    `\x1b[35m[EVALS]\x1b[0m ${codeQualityEval.name}: ${result.score.toFixed(2)} - ${result.reasoning.slice(0, 50)}...`
                );
            })
        );
    }

    // Code correctness eval (if both plan and files exist)
    if (
        runCodeCorrectness &&
        context.plan &&
        context.files &&
        context.files.length > 0
    ) {
        evalPromises.push(
            runSingleEval(codeCorrectnessEval, context).then((result) => {
                trace.score({
                    name: codeCorrectnessEval.name,
                    value: result.score,
                    comment: result.reasoning,
                });
                console.log(
                    `\x1b[35m[EVALS]\x1b[0m ${codeCorrectnessEval.name}: ${result.score.toFixed(2)} - ${result.reasoning.slice(0, 50)}...`
                );
            })
        );
    }

    // Add generation time as a metric if available
    if (context.generationTimeMs) {
        trace.score({
            name: "generationTimeSeconds",
            value: context.generationTimeMs / 1000,
            comment: `Total generation time: ${(context.generationTimeMs / 1000).toFixed(1)}s`,
        });
    }

    await Promise.all(evalPromises);
    console.log("\x1b[35m[EVALS]\x1b[0m Evaluations complete");
}

/**
 * Quick eval runner for a single evaluation type
 */
export async function runQuickEval(
    trace: LangfuseTrace,
    evalType: "codeQuality" | "planRelevance" | "codeCorrectness",
    context: EvalContext
): Promise<EvalResult> {
    const evalMap = {
        codeQuality: codeQualityEval,
        planRelevance: planRelevanceEval,
        codeCorrectness: codeCorrectnessEval,
    };

    const evalDef = evalMap[evalType];
    const result = await runSingleEval(evalDef, context);

    trace.score({
        name: evalDef.name,
        value: result.score,
        comment: result.reasoning,
    });

    return result;
}
