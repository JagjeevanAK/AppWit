// Download handler - GET /download/:sandboxId

import type { Request, Response } from "express";
import { activeSandboxes } from "@appwit/sandbox";
import { prisma } from "@/lib/prisma";

export async function handleDownload(req: Request, res: Response) {
  const sandboxId = req.params.sandboxId;

  if (!sandboxId) {
    return res.status(400).json({ error: "sandboxId is required" });
  }

  const session = activeSandboxes.get(sandboxId);

  if (!session) {
    return res.status(404).json({ error: "Sandbox session not found" });
  }

  try {
    const { sandbox, projectId } = session;

    // Fetch project name for the zip filename
    let projectName = "project";
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      });
      if (project?.name) {
        // Sanitize project name for filename (remove special characters)
        projectName = project.name
          .replace(/[^a-zA-Z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .toLowerCase()
          .slice(0, 50);
      }
    }

    const excludePatterns = [
      // Directories (same as frontend file tree)
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
      // Files (same as frontend file tree)
      ".bash_logout",
      ".bashrc",
      ".profile",
      "start.sh",
      ".sudo_as_admin_successful",
      "*.sudo",
      // Additional download exclusions
      ".env",
      ".env.local",
      ".env.production",
      "e2b.toml",
      "*.log",
      ".DS_Store",
      "bun.lockb",
      "package-lock.json",
      "yarn.lock",
    ];

    const excludeArgs = excludePatterns
      .map((p) => `-x '${p}' -x '${p}/*'`)
      .join(" ");

    const zipFileName = `${projectName}.zip`;
    const createZipCmd = `cd /home/user && zip -qr /tmp/${zipFileName} . ${excludeArgs}`;

    console.log(`[DOWNLOAD] Creating zip archive`);
    const result = await sandbox.commands.run(createZipCmd);

    if (result.exitCode !== 0) {
      console.error(`[DOWNLOAD] Failed to create zip: ${result.stderr}`);
      return res
        .status(500)
        .json({ error: "Failed to create project archive" });
    }

    // Read the ZIP file as binary data to prevent corruption
    const zipContent = await sandbox.files.read(`/tmp/${zipFileName}`, {
      format: "bytes",
    });

    await sandbox.commands.run(`rm /tmp/${zipFileName}`);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${zipFileName}"`
    );

    // zipContent is now a Uint8Array when format: "bytes" is used
    res.send(Buffer.from(zipContent as Uint8Array));

    console.log(
      `[DOWNLOAD] Project downloaded successfully for sandbox ${sandboxId}`
    );
  } catch (error) {
    console.error("Error downloading project:", error);
    res.status(500).json({ error: "Failed to download project" });
  }
}
