import type { ClientConfig } from "./types";

let cachedConfig: ClientConfig | null = null;

function loadConfig(): ClientConfig {
  return {
    backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000",
  };
}

export function getClientConfig(): ClientConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

export const clientConfig = getClientConfig();
