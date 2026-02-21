import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { existsSync } from "fs";
import type { ServerConfig } from "./types";
import type { StringValue } from "ms";

let envLoaded = false;

function findEnvFile(): string | undefined {
  const possiblePaths = [
    "/app/.env",
    resolve(import.meta.dirname, "../../../../.env"),
    resolve(import.meta.dirname, "../../../.env"),
    resolve(process.cwd(), ".env"),
  ];
  
  for (const envPath of possiblePaths) {
    if (existsSync(envPath)) {
      return envPath;
    }
  }
  return undefined;
}

function loadEnv(): void {
  if (envLoaded) return;
  
  const envPath = findEnvFile();
  if (envPath) {
    console.log(`[Config] Loading .env from: ${envPath}`);
    dotenvConfig({ path: envPath });
  } else {
    console.log(`[Config] No .env file found, using environment variables directly`);
  }
  envLoaded = true;
}

let cachedConfig: ServerConfig | null = null;

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseCorsOrigins(value: string | undefined): string[] {
  if (!value) return ["http://localhost:3000"];
  return value.split(",").map((origin) => origin.trim());
}

function parseLLMProvider(
  value: string | undefined
): ServerConfig["llm"]["provider"] {
  const lower = value?.toLowerCase();
  if (lower === "anthropic" || lower === "openai" || lower === "openrouter") {
    return lower;
  }
  return undefined;
}

function loadConfig(): ServerConfig {
  loadEnv();
  
  const nodeEnv = (process.env.NODE_ENV || "development") as ServerConfig["nodeEnv"];

  return {
    port: parseNumber(process.env.PORT, 4000),
    nodeEnv,

    jwt: {
      secret: process.env.JWT_SECRET || "your-secret-key",
      expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as StringValue,
    },

    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },

    urls: {
      frontend: process.env.FRONTEND_URL || "http://localhost:3000",
      backend: process.env.BACKEND_URL || "http://localhost:4000",
    },

    cors: {
      origins: parseCorsOrigins(process.env.CORS_ORIGINS),
    },

    database: {
      url:
        process.env.DATABASE_URL ||
        "postgresql://appwit:appwit_password@localhost:5432/appwit_db",
    },

    r2: {
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucketName: process.env.R2_BUCKET_NAME,
      publicUrl: process.env.R2_PUBLIC_URL,
    },

    sandbox: {
      templateId: process.env.TEMPLATE_ID,
      port: process.env.SANDBOX_PORT
        ? parseNumber(process.env.SANDBOX_PORT, 3000)
        : undefined,
    },

    llm: {
      provider: parseLLMProvider(process.env.LLM_PROVIDER),
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      openrouterApiKey: process.env.OPENROUTER_API_KEY,
    },

    langfuse: {
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      host: process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
    },

    session: {
      expiryDays: parseNumber(process.env.SESSION_EXPIRY_DAYS, 7),
    },

    vercel: {
      token: process.env.VERCEL_TOKEN,
      teamId: process.env.VERCEL_TEAM_ID,
    },
  };
}

export function getServerConfig(): ServerConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

export const serverConfig = getServerConfig();

export function isR2Configured(): boolean {
  const { r2 } = serverConfig;
  return !!(r2.accountId && r2.accessKeyId && r2.secretAccessKey && r2.bucketName);
}

export function isLangfuseConfigured(): boolean {
  const { langfuse } = serverConfig;
  return !!(langfuse.publicKey && langfuse.secretKey);
}

export function isVercelConfigured(): boolean {
  return !!serverConfig.vercel.token;
}

export function isGoogleAuthConfigured(): boolean {
  const { google } = serverConfig;
  return !!(google.clientId && google.clientSecret);
}

export function clearConfigCache(): void {
  cachedConfig = null;
}
