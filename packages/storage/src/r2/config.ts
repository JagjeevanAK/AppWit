import type { Sandbox } from "e2b";

export const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

export const BACKUP_MOUNT_PATH = "/mnt/backup";
export const PROJECT_PATH = "/home/user";

export const EXCLUDE_PATTERNS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".npm",
  ".cache",
  ".bun",
  "bun.lockb",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
];

export function isR2Configured(): boolean {
  const configured = !!(
    R2_ACCOUNT_ID &&
    R2_ACCESS_KEY_ID &&
    R2_SECRET_ACCESS_KEY &&
    R2_BUCKET_NAME
  );
  return configured;
}

console.log(
  `[R2] Configuration status: ${isR2Configured() ? "CONFIGURED" : "NOT CONFIGURED"}`
);

if (!isR2Configured()) {
  console.log(
    `[R2] Missing env vars - ACCOUNT_ID: ${!!R2_ACCOUNT_ID}, ACCESS_KEY: ${!!R2_ACCESS_KEY_ID}, SECRET_KEY: ${!!R2_SECRET_ACCESS_KEY}, BUCKET: ${!!R2_BUCKET_NAME}`
  );
}

export type { Sandbox };
