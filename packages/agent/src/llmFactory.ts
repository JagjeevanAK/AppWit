import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { serverConfig } from "@appwit/config/server";

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
    const provider = serverConfig.llm.provider;
    return provider || "openrouter";
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
          anthropicApiKey: serverConfig.llm.anthropicApiKey,
          maxTokens: 64000,
          temperature: 0,
        });

      case "openai":
        if (isCodexModel(this.model)) {
          console.log(
            `\x1b[36m[LLM]\x1b[0m Using Responses API for Codex model: ${this.model}`
          );
          return new ChatOpenAI({
            model: this.model,
            openAIApiKey: serverConfig.llm.openaiApiKey,
            maxTokens: 100000,
            temperature: 1,
            useResponsesApi: true,
          });
        }
        return new ChatOpenAI({
          model: this.model,
          openAIApiKey: serverConfig.llm.openaiApiKey,
          maxTokens: 16384,
          temperature: 0,
        });

      case "openrouter":
      default:
        return new ChatOpenAI({
          model: this.model,
          configuration: {
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: serverConfig.llm.openrouterApiKey,
          },
          maxTokens: 64000,
          temperature: 0,
        });
    }
  }
}

export const createLLM = (): BaseChatModel => {
  return LLMFactory.getInstance().create();
};
