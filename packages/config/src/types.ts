import type { StringValue } from "ms";

export interface ServerConfig {
  port: number;
  nodeEnv: "development" | "production" | "test";

  jwt: {
    secret: string;
    expiresIn: StringValue;
  };

  google: {
    clientId: string | undefined;
    clientSecret: string | undefined;
  };

  urls: {
    frontend: string;
    backend: string;
  };

  cors: {
    origins: string[];
  };

  database: {
    url: string;
  };

  r2: {
    accountId: string | undefined;
    accessKeyId: string | undefined;
    secretAccessKey: string | undefined;
    bucketName: string | undefined;
    publicUrl: string | undefined;
  };

  sandbox: {
    templateId: string | undefined;
    port: number | undefined;
  };

  llm: {
    provider: "anthropic" | "openai" | "openrouter" | undefined;
    anthropicApiKey: string | undefined;
    openaiApiKey: string | undefined;
    openrouterApiKey: string | undefined;
  };

  langfuse: {
    publicKey: string | undefined;
    secretKey: string | undefined;
    host: string;
  };

  session: {
    expiryDays: number;
  };

  vercel: {
    token: string | undefined;
    teamId: string | undefined;
  };
}

export interface ClientConfig {
  backendUrl: string;
}
