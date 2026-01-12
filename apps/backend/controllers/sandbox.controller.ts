import type { Request, Response } from "express";
import { activeSandboxes } from "@appwit/sandbox";
import {
  scheduleShutdown,
  handleTabVisibilityChange,
} from "@/services";

export const handleNotifyLeavingPublic = async (req: Request, res: Response) => {
  const { sandboxId } = req.params;

  if (!sandboxId) {
    return res.status(400).json({ error: "sandboxId is required" });
  }

  console.log(`[NOTIFY-LEAVING] Received (public route) for sandbox ${sandboxId}`);

  const session = activeSandboxes.get(sandboxId);
  if (!session) {
    console.log(`[NOTIFY-LEAVING] Session not found for ${sandboxId}`);
    return res.status(404).json({ error: "Sandbox session not found" });
  }

  const projectId = session.projectId;
  const userId = session.userId;

  console.log(`[NOTIFY-LEAVING] Project: ${projectId}, User: ${userId}`);

  if (!projectId || !userId) {
    return res.status(400).json({ error: "Session missing projectId or userId" });
  }

  await scheduleShutdown(sandboxId, projectId, userId);

  res.json({
    success: true,
    message: "Sandbox shutdown scheduled",
  });
};

export const handleVisibilityChange = async (req: Request, res: Response) => {
  const { sandboxId } = req.params;

  if (!sandboxId) {
    return res.status(400).json({ error: "sandboxId is required" });
  }

  const { isHidden } = req.body as { isHidden?: boolean };

  console.log(`[VISIBILITY] Received for sandbox ${sandboxId}, hidden: ${isHidden}`);

  const session = activeSandboxes.get(sandboxId);
  if (!session) {
    console.log(`[VISIBILITY] Session not found for ${sandboxId}`);
    return res.status(404).json({ error: "Sandbox session not found" });
  }

  handleTabVisibilityChange(sandboxId, isHidden === true);

  res.json({ success: true });
};
