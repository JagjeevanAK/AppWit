import type { Response } from "express";
import { streamMultiAgentOrchestrator, CONTEXT_SYSTEM_PROMPT } from "@appwit/agent";
import { MessageRole } from "@appwit/db";
import type { AuthRequest } from "@/middleware/auth";
import { activeSandboxes } from "@appwit/sandbox";
import {
    saveMessage,
    generateCodeSummary,
    buildEnhancedPrompt
} from "@/services";
import { buildPromptWithTheme } from "@/lib/prompt-utils";

export async function handleContinuePrompt(req: AuthRequest, res: Response) {
    const { prompt, sandboxId, theme } = req.body;

    if (!sandboxId) {
        return res.status(400).json({ error: 'sandboxId is required' });
    }

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return res.status(400).json({ error: 'prompt is required' });
    }

    const session = activeSandboxes.get(sandboxId);

    if (!session) {
        return res.status(404).json({ error: 'Sandbox session not found or expired' });
    }

    try {
        if (session.chatId) {
            await saveMessage(session.chatId, MessageRole.USER, prompt);
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Sandbox-URL', session.sandboxUrl);
        res.setHeader('X-Sandbox-ID', sandboxId);

        // Detect client disconnect so the orchestrator can continue running
        // even if the user navigates away. Without this, res.write() throws
        // ERR_STREAM_DESTROYED which breaks the for-await loop and aborts
        // the orchestrator mid-execution, leaving files partially written.
        let clientDisconnected = false;
        req.on("close", () => {
            clientDisconnected = true;
            console.log(`[SSE] Client disconnected for sandbox ${sandboxId}`);
        });

        function safeWrite(data: string): boolean {
            if (clientDisconnected || res.writableEnded || res.destroyed) {
                return false;
            }
            try {
                res.write(data);
                return true;
            } catch {
                clientDisconnected = true;
                return false;
            }
        }

        function safeEnd(): void {
            if (!clientDisconnected && !res.writableEnded && !res.destroyed) {
                try {
                    res.end();
                } catch {
                    clientDisconnected = true;
                }
            }
        }

        console.log(`[Continue] Continuing conversation in sandbox ${sandboxId}`);

        try {
            session.isStreaming = true;

            console.log(`[Continue] Building enhanced prompt with context...`);
            const promptWithTheme = buildPromptWithTheme(prompt, theme);
            const enhancedPrompt = await buildEnhancedPrompt(
                promptWithTheme,
                session.projectId,
                session.chatId,
                session.sandbox
            );

            const modifiedFiles: string[] = [];
            let commandCount = 0;

            for await (const event of streamMultiAgentOrchestrator(session.sandbox, enhancedPrompt, CONTEXT_SYSTEM_PROMPT)) {
                if (event.type === 'file_created' && event.filePath) {
                    modifiedFiles.push(event.filePath);
                }
                if (event.type === 'executing') {
                    commandCount++;
                }
                safeWrite(`data: ${JSON.stringify(event)}\n\n`);
            }

            session.isStreaming = false;

            if (clientDisconnected) {
                console.log(
                    `[SSE] Client left during streaming for ${sandboxId}, but orchestrator completed successfully (${modifiedFiles.length} files)`
                );
            }

            const summary = generateCodeSummary(modifiedFiles, commandCount, 'updated');

            if (session.chatId) {
                await saveMessage(session.chatId, MessageRole.ASSISTANT, summary, summary);
            }

            safeWrite(`data: ${JSON.stringify({ type: 'summary', message: summary })}\n\n`);
            safeWrite(`data: ${JSON.stringify({ type: 'done', sandboxUrl: session.sandboxUrl, sandboxId })}\n\n`);
            safeEnd();

        } catch (streamError) {
            session.isStreaming = false;
            console.error('Error during orchestration:', streamError);
            safeWrite(`data: ${JSON.stringify({ type: 'error', message: 'Orchestration error occurred' })}\n\n`);
            safeEnd();
        }

    } catch (error) {
        console.error('Error continuing conversation:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to continue conversation' });
        }
    }
}
