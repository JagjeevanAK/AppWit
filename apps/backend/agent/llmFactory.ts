import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export type LLMProvider = "openrouter" | "anthropic" | "openai";

/**
 * Check if the model is a Codex model that requires the Responses API.
 * Codex models (gpt-5.1-codex-max, etc.) require the Responses API for
 * better support of agentic coding tasks.
 */
function isCodexModel(model: string): boolean {
  return model.toLowerCase().includes("codex");
}

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openrouter: "anthropic/claude-sonnet-4-20250514",
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
};

const MODEL_ENV_VARS: Record<LLMProvider, string> = {
  openrouter: "OPENROUTER_MODEL",
  anthropic: "ANTHROPIC_MODEL",
  openai: "OPENAI_MODEL",
};

export class LLMFactory {
  private static instance: LLMFactory | null = null;

  private provider: LLMProvider;
  private model: string;

  private constructor() {
    this.provider = this.resolveProvider();
    this.model = this.resolveModel();
  }

  public static getInstance(): LLMFactory {
    if (!LLMFactory.instance) {
      LLMFactory.instance = new LLMFactory();
    }
    return LLMFactory.instance;
  }

  private resolveProvider(): LLMProvider {
    const provider = process.env.LLM_PROVIDER?.toLowerCase() as LLMProvider;
    return ["openrouter", "anthropic", "openai"].includes(provider)
      ? provider
      : "openrouter";
  }

  private resolveModel(): string {
    const envVar = MODEL_ENV_VARS[this.provider];
    return process.env[envVar] || DEFAULT_MODELS[this.provider];
  }

  public getProviderName(): LLMProvider {
    return this.provider;
  }

  public getModelName(): string {
    return this.model;
  }

  public create(): BaseChatModel {
    console.log(
      `\x1b[32m[LLM]\x1b[0m Provider: ${this.provider}, Model: ${this.model}`
    );

    switch (this.provider) {
      case "anthropic":
        return new ChatAnthropic({
          model: this.model,
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
          maxTokens: 64000, // Claude Sonnet 4.5 max output
          temperature: 0, // Deterministic output for code
        });

      case "openai":
        // Use Responses API for Codex models (gpt-5.1-codex-max, etc.)
        // The Responses API provides better support for agentic coding tasks
        if (isCodexModel(this.model)) {
          console.log(
            `\x1b[36m[LLM]\x1b[0m Using Responses API for Codex model: ${this.model}`
          );
          return new ChatOpenAI({
            model: this.model,
            openAIApiKey: process.env.OPENAI_API_KEY,
            maxTokens: 100000, // Codex models support higher output limits
            temperature: 1, // Codex models require temperature=1
            useResponsesApi: true,
          });
        }
        return new ChatOpenAI({
          model: this.model,
          openAIApiKey: process.env.OPENAI_API_KEY,
          maxTokens: 16384, // GPT-4o limit
          temperature: 0,
        });

      case "openrouter":
      default:
        return new ChatOpenAI({
          model: this.model,
          configuration: {
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: process.env.OPENROUTER_API_KEY,
          },
          maxTokens: 64000, // Claude via OpenRouter max output
          temperature: 0,
        });
    }
  }
}

export const createLLM = (): BaseChatModel => {
  return LLMFactory.getInstance().create();
};
