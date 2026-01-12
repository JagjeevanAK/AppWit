import type { Request, Response } from "express";
import {
  readFile,
  listFiles,
  FilesServiceError,
} from "../services/files.service";

export const readFileController = async (req: Request, res: Response) => {
  const { sandboxId, path } = req.query;

  if (!sandboxId || typeof sandboxId !== "string") {
    return res.status(400).json({ error: "sandboxId is required" });
  }

  if (!path || typeof path !== "string") {
    return res.status(400).json({ error: "path is required" });
  }

  try {
    const content = await readFile(sandboxId, path);
    res.json({ success: true, path, content });
  } catch (error) {
    if (error instanceof FilesServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error reading file:", error);
    res.status(500).json({
      error: "Failed to read file",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const listFilesController = async (req: Request, res: Response) => {
  const { sandboxId, path = "/home/user" } = req.query;

  if (!sandboxId || typeof sandboxId !== "string") {
    return res.status(400).json({ error: "sandboxId is required" });
  }

  try {
    const files = await listFiles(
      sandboxId,
      typeof path === "string" ? path : "/home/user"
    );
    res.json({ success: true, path, files });
  } catch (error) {
    if (error instanceof FilesServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error listing files:", error);
    res.status(500).json({
      error: "Failed to list files",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
