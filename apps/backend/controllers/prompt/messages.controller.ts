/**
 * MODULE: Chat Messages Handler
 *
 * Returns chat messages for a project to display in the ChatBar.
 * Used when reopening a saved project to restore conversation history.
 */

import type { Response } from "express";
import type { AuthRequest } from "@/middleware/auth";
import { prisma } from "@/lib/prisma";
import { getProjectChatMessages } from "@/services";

export async function handleGetMessages(req: AuthRequest, res: Response) {
  const projectId = req.params.projectId;
  const userId = req.userId;

  if (!projectId) {
    return res.status(400).json({ error: "projectId is required" });
  }

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Verify project exists and belongs to user
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const messages = await getProjectChatMessages(projectId);

    res.json({
      projectId,
      messages,
    });
  } catch (error) {
    console.error("[MESSAGES] Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
}
