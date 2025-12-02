import { createAgent, toolCallLimitMiddleware } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, ToolMessage, SystemMessage } from "@langchain/core/messages";
import type { Sandbox } from "e2b";
import { createSandboxTools } from "../tools";
import { SYSTEM_PROMPT } from "./systemPrompt";

const MAX_ITERATIONS = 15;

const createModel = () => {
    return new ChatOpenAI({
        model: "anthropic/claude-sonnet-4",
        temperature: 0,
        configuration: {
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: process.env.OPENROUTER_API_KEY,
        },
    });
};

export function createAgentGraph(sandbox: Sandbox) {
    const tools = createSandboxTools(sandbox);
    const model = createModel();

    const agent = createAgent({
        model,
        tools,
        systemPrompt: SYSTEM_PROMPT,
        middleware: [
            toolCallLimitMiddleware({ runLimit: MAX_ITERATIONS })
        ]
    });

    return agent;
}

export type AgentGraph = ReturnType<typeof createAgentGraph>;

export async function* streamAgentResponse(
    graph: AgentGraph,
    userMessage: string,
    previousMessages: (HumanMessage | AIMessage | ToolMessage | SystemMessage)[] = []
) {
    const inputMessages = [
        ...previousMessages,
        new HumanMessage(userMessage)
    ];

    console.log('Starting agent stream with', inputMessages.length, 'messages');

    for await (const event of await graph.stream(
        { messages: inputMessages },
        { 
            streamMode: "messages",
        }
    )) {
        const [message, metadata] = event;
        
        if (AIMessage.isInstance(message)) {
            if (message.content && typeof message.content === 'string') {
                yield {
                    type: 'text' as const,
                    content: message.content
                };
            }
            
            if (message.tool_calls && message.tool_calls.length > 0) {
                for (const toolCall of message.tool_calls) {
                    yield {
                        type: 'tool_call' as const,
                        name: toolCall.name,
                        args: toolCall.args
                    };
                }
            }
        }
        
        if (ToolMessage.isInstance(message)) {
            yield {
                type: 'tool_result' as const,
                content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
            };
        }
    }
}

export async function runAgent(
    graph: AgentGraph,
    userMessage: string,
    previousMessages: (HumanMessage | AIMessage | ToolMessage | SystemMessage)[] = []
) {
    const inputMessages = [
        ...previousMessages,
        new HumanMessage(userMessage)
    ];

    const result = await graph.invoke({ messages: inputMessages });
    
    return result.messages;
}
