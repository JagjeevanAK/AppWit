import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import {
  createProject,
  listProjects,
  getProject,
  deleteProject,
  ProjectServiceError,
} from "../services/project.service";

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
