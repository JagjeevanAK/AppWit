/**
 * MODULE: Langfuse Observability
 *
 * Provides tracing, spans, and LangChain callback integration for
 * observability across the entire LangGraph agent pipeline.
 *
 * Usage:
 *   import { langfuse, createTrace, createSpan } from './observability/langfuse';
 *
 * Traces are created per user session/request and contain multiple spans
 * representing each node in the pipeline.
 */

import { Langfuse } from "langfuse";
import { CallbackHandler } from "langfuse-langchain";
import { serverConfig, isLangfuseConfigured } from "@appwit/config/server";

let langfuseInstance: Langfuse | null = null;

/**
 * Get or create the Langfuse client singleton.
 * Returns null if credentials are not configured.
 */
export function getLangfuse(): Langfuse | null {
    if (langfuseInstance) {
        return langfuseInstance;
    }

    if (!isLangfuseConfigured()) {
        console.log(
            "\x1b[33m[LANGFUSE]\x1b[0m Credentials not configured, tracing disabled"
        );
        return null;
    }

    langfuseInstance = new Langfuse({
        publicKey: serverConfig.langfuse.publicKey!,
        secretKey: serverConfig.langfuse.secretKey!,
        baseUrl: serverConfig.langfuse.host,
    });

    console.log("\x1b[32m[LANGFUSE]\x1b[0m Initialized successfully");
    return langfuseInstance;
}

/**
 * Check if Langfuse is enabled (credentials configured)
 */
export function isLangfuseEnabled(): boolean {
    return isLangfuseConfigured();
}

/**
 * Trace options for creating a new trace
 */
export interface TraceOptions {
    name: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
}

/**
 * Span options for creating a new span within a trace
 */
export interface SpanOptions {
    name: string;
    input?: unknown;
    metadata?: Record<string, unknown>;
}

/**
 * Wrapper class for Langfuse trace with helper methods
 */
export class LangfuseTrace {
    private trace: ReturnType<Langfuse["trace"]>;

    constructor(trace: ReturnType<Langfuse["trace"]>) {
        this.trace = trace;
    }

    /**
     * Get the underlying Langfuse trace object
     */
    getTrace() {
        return this.trace;
    }

    /**
     * Get the trace ID
     */
    getId(): string {
        return this.trace.id;
    }

    /**
     * Create a span within this trace
     */
    createSpan(options: SpanOptions) {
        return new LangfuseSpan(
            this.trace.span({
                name: options.name,
                input: options.input,
                metadata: options.metadata,
            })
        );
    }

    /**
     * Create a LangChain callback handler for this trace.
     * Use this to automatically trace all LLM calls.
     */
    createCallbackHandler(spanName?: string): CallbackHandler {
        return new CallbackHandler({
            root: this.trace,
            updateRoot: true,
        });
    }

    /**
     * Add a score to this trace (for evals)
     */
    score(options: {
        name: string;
        value: number;
        comment?: string;
        dataType?: "NUMERIC" | "BOOLEAN";
    }) {
        this.trace.score({
            name: options.name,
            value: options.value,
            comment: options.comment,
            dataType: options.dataType || "NUMERIC",
        });
    }

    /**
     * Update trace with output and end it
     */
    end(output?: unknown) {
        this.trace.update({ output });
    }
}

/**
 * Wrapper class for Langfuse span with helper methods
 */
export class LangfuseSpan {
    private span: ReturnType<ReturnType<Langfuse["trace"]>["span"]>;

    constructor(span: ReturnType<ReturnType<Langfuse["trace"]>["span"]>) {
        this.span = span;
    }

    /**
     * Get the underlying Langfuse span object
     */
    getSpan() {
        return this.span;
    }

    /**
     * Create a nested span
     */
    createSpan(options: SpanOptions) {
        return new LangfuseSpan(
            this.span.span({
                name: options.name,
                input: options.input,
                metadata: options.metadata,
            })
        );
    }

    /**
     * Create a LangChain callback handler for this span
     */
    createCallbackHandler(): CallbackHandler {
        return new CallbackHandler({
            root: this.span,
            updateRoot: true,
        });
    }

    /**
     * Update span with output, status, and end it
     */
    end(options?: {
        output?: unknown;
        level?: "DEBUG" | "DEFAULT" | "WARNING" | "ERROR";
        statusMessage?: string;
    }) {
        this.span.end({
            output: options?.output,
            level: options?.level,
            statusMessage: options?.statusMessage,
        });
    }
}

/**
 * Create a new trace for a pipeline execution.
 * Returns null if Langfuse is not configured.
 */
export function createTrace(options: TraceOptions): LangfuseTrace | null {
    const langfuse = getLangfuse();
    if (!langfuse) {
        return null;
    }

    const trace = langfuse.trace({
        name: options.name,
        userId: options.userId,
        sessionId: options.sessionId,
        metadata: options.metadata,
        tags: options.tags,
    });

    console.log(`\x1b[32m[LANGFUSE]\x1b[0m Created trace: ${trace.id}`);
    return new LangfuseTrace(trace);
}

/**
 * Flush all pending Langfuse events.
 * Call this at the end of request handling to ensure events are sent.
 */
export async function flushLangfuse(): Promise<void> {
    const langfuse = getLangfuse();
    if (langfuse) {
        await langfuse.flushAsync();
    }
}

/**
 * Shutdown Langfuse client gracefully.
 * Call this when the server is shutting down.
 */
export async function shutdownLangfuse(): Promise<void> {
    const langfuse = getLangfuse();
    if (langfuse) {
        await langfuse.shutdownAsync();
        langfuseInstance = null;
    }
}

export { CallbackHandler };
