import crypto from "crypto";
import { activeSandboxes } from "@appwit/sandbox";
import { serverConfig, isVercelConfigured } from "@appwit/config/server";
import { prisma } from "../lib/prisma";

const VERCEL_API = "https://api.vercel.com";
const VERCEL_FETCH_TIMEOUT_MS = 30_000; // 30s per Vercel API call

interface VercelDeploymentResponse {
  alias?: string[];
  aliasAssigned?: boolean;
  automaticAliases?: string[];
  bootedAt?: number;
  buildingAt?: number;
  buildSkipped?: boolean;
  createdAt?: number;
  creator?: {
    uid: string;
    username: string;
  };
  id?: string;
  name?: string;
  meta?: Record<string, any>;
  originCacheRegion?: string;
  project?: {
    id: string;
    name: string;
    framework: string;
  };
  public?: boolean;
  readyState?: string;
  regions?: string[];
  status?: string;
  target?: string;
  team?: {
    id: string;
    name: string;
    slug: string;
  };
  type?: string;
  url?: string;
  version?: number;
  previewCommentsEnabled?: boolean;
  oidcTokenClaims?: {
    sub: string;
    iss: string;
    scope: string;
    aud: string;
    owner: string;
    owner_id: string;
    project: string;
    project_id: string;
    environment: string;
    plan: string;
  };
  lambdas?: Array<{
    id: string;
    createdAt: number;
    entrypoint: string;
    readyState: string;
    readyStateAt: number;
    output: any[];
  }>;
  aliasAssignedAt?: number | null;
  build?: {
    env: any[];
  };
  builds?: any[];
  createdIn?: string;
  env?: any[];
  functions?: any;
  inspectorUrl?: string;
  isInConcurrentBuildsQueue?: boolean;
  isInSystemBuildsQueue?: boolean;
  ownerId?: string;
  plan?: string;
  projectId?: string;
  projectSettings?: {
    buildCommand: string | null;
    devCommand: string | null;
    framework: string;
    commandForIgnoringBuildStep: string | null;
    installCommand: string | null;
    outputDirectory: string | null;
    speedInsights: {
      id: string;
      hasData: boolean;
    };
    webAnalytics: {
      id: string;
    };
    nodeVersion: string;
  };
  routes?: any;
  config?: {
    version: number;
    secureComputePrimaryRegion: string | null;
    secureComputeFallbackRegion: string | null;
    functionTimeout: number;
    functionType: string;
    functionMemoryType: string;
    isUsingActiveCPU: boolean;
    resourceConfig: Record<string, any>;
  };
}

const EXCLUDE_PATTERNS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".vite",
  ".vite-temp",
  ".npm",
  ".cache",
  ".local",
  ".config",
  ".pnpm",
  ".yarn",
  ".bun",
  ".e2b",
  ".log",
  ".bash_logout",
  ".bashrc",
  ".profile",
  "start.sh",
  ".sudo_as_admin_successful",
  ".env",
  ".env.local",
  ".env.production",
  "e2b.toml",
  ".DS_Store",
  "bun.lockb",
  "package-lock.json",
  "yarn.lock",
];

export class DeployServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "DeployServiceError";
  }
}

interface FileEntry {
  file: string;
  data: Buffer;
  sha: string;
  size: number;
}

function shouldExclude(path: string): boolean {
  const parts = path.split("/");
  return parts.some((part) =>
    EXCLUDE_PATTERNS.some((pattern) => {
      if (pattern.startsWith("*.")) {
        return part.endsWith(pattern.slice(1));
      }
      return part === pattern;
    })
  );
}

function findSandboxByProjectId(projectId: string) {
  for (const [sandboxId, session] of activeSandboxes) {
    if (session.projectId === projectId) {
      return { sandboxId, session };
    }
  }
  return null;
}

async function extractSandboxFiles(sandboxId: string): Promise<FileEntry[]> {
  const session = activeSandboxes.get(sandboxId);
  if (!session) {
    throw new DeployServiceError("Sandbox session not found", 404);
  }

  const { sandbox } = session;
  const files: FileEntry[] = [];

  const result = await sandbox.commands.run(
    "find /home/user -type f " +
      "-not -path '*/node_modules/*' " +
      "-not -path '*/.next/*' " +
      "-not -path '*/.git/*' " +
      "-not -path '*/dist/*' " +
      "-not -path '*/build/*' " +
      "-not -path '*/.cache/*' " +
      "-not -path '*/.bun/*' " +
      "-not -path '*/.local/*' " +
      "-not -path '*/.config/*' " +
      "-not -path '*/.e2b/*' " +
      "-not -path '*/.vite/*' " +
      "-not -path '*/.vite-temp/*'"
  );

  if (result.exitCode !== 0) {
    throw new DeployServiceError("Failed to list sandbox files", 500);
  }

  const filePaths = result.stdout
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  for (const absolutePath of filePaths) {
    const relativePath = absolutePath.replace("/home/user/", "");

    if (shouldExclude(relativePath)) continue;

    try {
      const content = await sandbox.files.read(absolutePath, {
        format: "bytes",
      });
      const data = Buffer.from(content as Uint8Array);
      const sha = crypto.createHash("sha1").update(data).digest("hex");

      files.push({
        file: relativePath,
        data,
        sha,
        size: data.length,
      });
    } catch (err) {
      console.warn(`[DEPLOY] Skipping file ${relativePath}: ${err}`);
    }
  }

  console.log(
    `[DEPLOY] Extracted ${files.length} files from sandbox ${sandboxId}`
  );
  return files;
}

function vercelHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${serverConfig.vercel.token}`,
    "Content-Type": "application/json",
  };
}

function teamQuery(): string {
  return serverConfig.vercel.teamId
    ? `?teamId=${serverConfig.vercel.teamId}`
    : "";
}

async function createVercelProject(projectName: string): Promise<string> {
  const response = await fetch(`${VERCEL_API}/v10/projects${teamQuery()}`, {
    method: "POST",
    headers: vercelHeaders(),
    body: JSON.stringify({
      name: projectName,
      framework: "nextjs",
    }),
    signal: AbortSignal.timeout(VERCEL_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    if (response.status === 409) {
      const getResponse = await fetch(
        `${VERCEL_API}/v9/projects/${projectName}${teamQuery()}`,
        { headers: vercelHeaders(), signal: AbortSignal.timeout(VERCEL_FETCH_TIMEOUT_MS) }
      );
      if (getResponse.ok) {
        const data = (await getResponse.json()) as { id: string };
        return data.id;
      }
    }
    const body = await response.text();
    throw new DeployServiceError(
      `Failed to create Vercel project: ${body}`,
      response.status
    );
  }

  const data = (await response.json()) as { id: string };
  return data.id;
}

async function uploadFilesToVercel(files: FileEntry[]): Promise<void> {
  const BATCH_SIZE = 10;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (file) => {
        const response = await fetch(`${VERCEL_API}/v2/files${teamQuery()}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serverConfig.vercel.token}`,
            "Content-Type": "application/octet-stream",
            "x-vercel-digest": file.sha,
            "Content-Length": String(file.size),
          },
          body: file.data,
          signal: AbortSignal.timeout(VERCEL_FETCH_TIMEOUT_MS),
        });

        // 409 means file already exists (same SHA) — that's fine
        if (!response.ok && response.status !== 409) {
          const body = await response.text();
          throw new DeployServiceError(
            `Failed to upload file ${file.file}: ${body}`,
            response.status
          );
        }
      })
    );
  }

  console.log(`[DEPLOY] Uploaded ${files.length} files to Vercel`);
}

async function createDeployment(
  projectIdentifier: string,
  files: FileEntry[]
): Promise<{ url: string; deploymentId: string }> {
  const response = await fetch(
    `${VERCEL_API}/v13/deployments${teamQuery()}`,
    {
      method: "POST",
      headers: vercelHeaders(),
      body: JSON.stringify({
        name: projectIdentifier,
        files: files.map((f) => ({
          file: f.file,
          sha: f.sha,
          size: f.size,
        })),
        project: projectIdentifier,
        target: "production",
      }),
      signal: AbortSignal.timeout(VERCEL_FETCH_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new DeployServiceError(
      `Failed to create deployment: ${body}`,
      response.status
    );
  }

  const data = (await response.json()) as VercelDeploymentResponse;

  const previewUrl = `https://${data.project?.name}.vercel.app`;
  return {
    url: previewUrl,
    deploymentId: data.id ?? "",
  };
}

export interface DeployResult {
  deploymentUrl: string;
  vercelProjectId: string;
  isRedeploy: boolean;
}

export async function deployToVercel(
  projectId: string,
  userId: string
): Promise<DeployResult> {
  if (!isVercelConfigured()) {
    throw new DeployServiceError(
      "Vercel deployment is not configured",
      503
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      userId: true,
      vercelProjectId: true,
    },
  });

  if (!project) {
    throw new DeployServiceError("Project not found", 404);
  }
  if (project.userId !== userId) {
    throw new DeployServiceError("Forbidden", 403);
  }

  // Find the active sandbox for this project from the in-memory map
  const sandboxEntry = findSandboxByProjectId(projectId);
  if (!sandboxEntry) {
    throw new DeployServiceError(
      "No active sandbox for this project. Please open the project first.",
      400
    );
  }

  if (sandboxEntry.session.isStreaming) {
    throw new DeployServiceError(
      "Cannot deploy while code is being generated. Please wait for generation to complete.",
      409
    );
  }

  const cleaned = project.name
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "project";
  const sanitizedName = `appwit-${cleaned}-${project.id.slice(0, 8)}`;

  const isRedeploy = !!project.vercelProjectId;

  let vercelProjectId: string;
  if (project.vercelProjectId) {
    vercelProjectId = project.vercelProjectId;
  } else {
    vercelProjectId = await createVercelProject(sanitizedName);
  }

  const files = await extractSandboxFiles(sandboxEntry.sandboxId);

  if (files.length === 0) {
    throw new DeployServiceError("No files found in sandbox", 400);
  }

  await uploadFilesToVercel(files);

  // On redeploy, use the stored Vercel project ID to avoid issues if project was renamed
  const deployment = await createDeployment(
    isRedeploy ? vercelProjectId : sanitizedName,
    files
  );

  await prisma.project.update({
    where: { id: projectId },
    data: {
      vercelProjectId,
      vercelDeployUrl: deployment.url,
      lastDeployedAt: new Date(),
    },
  });

  console.log(
    `[DEPLOY] Successfully deployed project ${projectId} to ${deployment.url}`
  );

  return {
    deploymentUrl: deployment.url,
    vercelProjectId,
    isRedeploy,
  };
}

export async function getDeploymentStatus(
  projectId: string,
  userId: string
): Promise<{
  status: string;
  url: string | null;
  lastDeployedAt: Date | null;
}> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      userId: true,
      vercelDeployUrl: true,
      lastDeployedAt: true,
      vercelProjectId: true,
    },
  });

  if (!project) {
    throw new DeployServiceError("Project not found", 404);
  }
  if (project.userId !== userId) {
    throw new DeployServiceError("Forbidden", 403);
  }

  if (!project.vercelProjectId) {
    return { status: "not_deployed", url: null, lastDeployedAt: null };
  }

  return {
    status: "deployed",
    url: project.vercelDeployUrl,
    lastDeployedAt: project.lastDeployedAt,
  };
}
