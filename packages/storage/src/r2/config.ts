import type { Sandbox } from "e2b";
import { serverConfig, isR2Configured } from "@appwit/config/server";

export const R2_ACCOUNT_ID = serverConfig.r2.accountId;
export const R2_ACCESS_KEY_ID = serverConfig.r2.accessKeyId;
export const R2_SECRET_ACCESS_KEY = serverConfig.r2.secretAccessKey;
export const R2_BUCKET_NAME = serverConfig.r2.bucketName;

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

export { isR2Configured };

console.log(
  `[R2] Configuration status: ${isR2Configured() ? "CONFIGURED" : "NOT CONFIGURED"}`
);

if (!isR2Configured()) {
  console.log(
    `[R2] Missing env vars - ACCOUNT_ID: ${!!R2_ACCOUNT_ID}, ACCESS_KEY: ${!!R2_ACCESS_KEY_ID}, SECRET_KEY: ${!!R2_SECRET_ACCESS_KEY}, BUCKET: ${!!R2_BUCKET_NAME}`
  );
}

export type { Sandbox };
