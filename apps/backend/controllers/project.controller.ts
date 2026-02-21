import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { serverConfig, isR2Configured } from "@appwit/config/server";
import { prisma } from "../lib/prisma";
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  ProjectServiceError,
} from "../services/project.service";

const { r2 } = serverConfig;

let thumbnailS3Client: S3Client | null = null;

function getThumbnailS3Client(): S3Client | null {
  if (!isR2Configured()) {
    return null;
  }

  if (!thumbnailS3Client) {
    thumbnailS3Client = new S3Client({
      region: "auto",
      endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2.accessKeyId!,
        secretAccessKey: r2.secretAccessKey!,
      },
    });
  }

  return thumbnailS3Client;
}

export const createProjectController = async (
  req: AuthRequest,
  res: Response
) => {
  const { name, description } = req.body;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const project = await createProject({ name, description, userId });
    res.json(project);
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
};

export const listProjectsController = async (
  req: AuthRequest,
  res: Response
) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const projects = await listProjects(userId);
    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
};

export const getProjectController = async (req: AuthRequest, res: Response) => {
  const { projectId } = req.params;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!projectId) {
    return res.status(400).json({ error: "Project ID required" });
  }

  try {
    const project = await getProject(projectId, userId);
    res.json(project);
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching project:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
};

export const updateProjectController = async (
  req: AuthRequest,
  res: Response
) => {
  const { projectId } = req.params;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!projectId) {
    return res.status(400).json({ error: "Project ID required" });
  }

  const { name } = req.body;

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return res.status(400).json({ error: "Invalid project name" });
  }

  try {
    const project = await updateProject(projectId, userId, {
      name: name?.trim(),
    });
    res.json(project);
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error updating project:", error);
    res.status(500).json({ error: "Failed to update project" });
  }
};

export const deleteProjectController = async (
  req: AuthRequest,
  res: Response
) => {
  const { projectId } = req.params;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!projectId) {
    return res.status(400).json({ error: "Project ID required" });
  }

  try {
    await deleteProject(projectId, userId);
    res.json({ success: true, message: "Project deleted" });
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
};

export const getThumbnailController = async (
  req: AuthRequest,
  res: Response
) => {
  const { projectId } = req.params;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!projectId) {
    return res.status(400).json({ error: "Project ID required" });
  }

  const client = getThumbnailS3Client();
  if (!client || !r2.bucketName) {
    return res.status(503).json({ error: "Thumbnail storage is not configured" });
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true, thumbnailUrl: true },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (!project.thumbnailUrl) {
      return res.status(404).json({ error: "Thumbnail not found" });
    }

    // Derive the R2 key from the stored URL to avoid hardcoding the path pattern
    const publicUrlPrefix = r2.publicUrl ? `${r2.publicUrl}/` : null;
    const key =
      publicUrlPrefix && project.thumbnailUrl.startsWith(publicUrlPrefix)
        ? project.thumbnailUrl.slice(publicUrlPrefix.length)
        : `thumbnails/${userId}/${projectId}.png`;

    const object = await client.send(
      new GetObjectCommand({
        Bucket: r2.bucketName,
        Key: key,
      })
    );

    if (!object.Body) {
      return res.status(404).json({ error: "Thumbnail not found" });
    }

    res.setHeader("Content-Type", object.ContentType || "image/png");
    res.setHeader("Cache-Control", "private, max-age=3600");

    const body = object.Body as {
      pipe?: (destination: Response) => void;
      transformToByteArray?: () => Promise<Uint8Array>;
      [Symbol.asyncIterator]?: () => AsyncIterator<
        Uint8Array | Buffer | string
      >;
    };

    if (typeof body.pipe === "function") {
      body.pipe(res);
      return;
    }

    if (typeof body.transformToByteArray === "function") {
      const bytes = await body.transformToByteArray();
      res.end(Buffer.from(bytes));
      return;
    }

    if (body[Symbol.asyncIterator]) {
      const chunks: Buffer[] = [];
      for await (const chunk of body as AsyncIterable<Uint8Array | Buffer | string>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      res.end(Buffer.concat(chunks));
      return;
    }

    return res.status(500).json({ error: "Unsupported thumbnail stream format" });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      ("name" in error || "$metadata" in error)
    ) {
      const name = "name" in error ? String(error.name) : "";
      const statusCode =
        "$metadata" in error &&
        typeof error.$metadata === "object" &&
        error.$metadata !== null &&
        "httpStatusCode" in error.$metadata
          ? Number(error.$metadata.httpStatusCode)
          : null;

      if (name === "NoSuchKey" || statusCode === 404) {
        return res.status(404).json({ error: "Thumbnail not found" });
      }
    }

    console.error("Error fetching thumbnail:", error);
    return res.status(500).json({ error: "Failed to fetch thumbnail" });
  }
};
