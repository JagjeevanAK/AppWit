import { prisma } from "../lib/prisma";
import { ProjectStatus } from "@appwit/db";
import { deleteThumbnail } from "../lib/screenshot";

export class ProjectServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "ProjectServiceError";
  }
}

export interface CreateProjectInput {
  name?: string;
  description?: string;
  userId: string;
}

export interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
}

export const createProject = async (
  input: CreateProjectInput
): Promise<ProjectResponse> => {
  const project = await prisma.project.create({
    data: {
      name: input.name || "Untitled Project",
      description: input.description || null,
      userId: input.userId,
      status: ProjectStatus.ACTIVE,
    },
  });

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt,
  };
};

export const listProjects = async (userId: string) => {
  return prisma.project.findMany({
    where: {
      userId,
      status: ProjectStatus.ACTIVE,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      thumbnailUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

export const getProject = async (projectId: string, userId: string) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      chats: {
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              role: true,
              content: true,
              summary: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) {
    throw new ProjectServiceError("Project not found", 404);
  }

  if (project.userId !== userId) {
    throw new ProjectServiceError("Forbidden", 403);
  }

  return project;
};

export const updateProject = async (
  projectId: string,
  userId: string,
  data: { name?: string }
) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });

  if (!project) {
    throw new ProjectServiceError("Project not found", 404);
  }

  if (project.userId !== userId) {
    throw new ProjectServiceError("Forbidden", 403);
  }

  return prisma.project.update({
    where: { id: projectId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

export const deleteProject = async (
  projectId: string,
  userId: string
): Promise<void> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true, r2BackupPath: true },
  });

  if (!project) {
    throw new ProjectServiceError("Project not found", 404);
  }

  if (project.userId !== userId) {
    throw new ProjectServiceError("Forbidden", 403);
  }

  if (project.r2BackupPath) {
    const { deleteProjectFromR2 } = await import("@appwit/storage");
    await deleteProjectFromR2(userId, projectId);
  }

  await deleteThumbnail(userId, projectId);

  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: ProjectStatus.DELETED,
      r2BackupPath: null,
      thumbnailUrl: null,
    },
  });
};
