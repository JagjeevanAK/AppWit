import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import {
  deployToVercel,
  getDeploymentStatus,
  DeployServiceError,
} from "../services/deploy.service";

export const deployProjectController = async (
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
    const result = await deployToVercel(projectId, userId);
    res.json({
      success: true,
      deploymentUrl: result.deploymentUrl,
      vercelProjectId: result.vercelProjectId,
      isRedeploy: result.isRedeploy,
    });
  } catch (error) {
    if (error instanceof DeployServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error deploying project:", error);
    res.status(500).json({ error: "Failed to deploy project" });
  }
};

export const getDeploymentStatusController = async (
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
    const status = await getDeploymentStatus(projectId, userId);
    res.json(status);
  } catch (error) {
    if (error instanceof DeployServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching deployment status:", error);
    res.status(500).json({ error: "Failed to fetch deployment status" });
  }
};
