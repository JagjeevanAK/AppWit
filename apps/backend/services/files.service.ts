import { activeSandboxes } from "../routes/prompt.route";

export class FilesServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "FilesServiceError";
  }
}

export interface FileInfo {
  name: string;
  type: string | undefined;
  path: string;
}

export const readFile = async (
  sandboxId: string,
  path: string
): Promise<string> => {
  const session = activeSandboxes.get(sandboxId);

  if (!session) {
    throw new FilesServiceError("Sandbox not found or expired", 404);
  }

  return session.sandbox.files.read(path);
};

export const listFiles = async (
  sandboxId: string,
  path: string = "/home/user"
): Promise<FileInfo[]> => {
  const session = activeSandboxes.get(sandboxId);

  if (!session) {
    throw new FilesServiceError("Sandbox not found or expired", 404);
  }

  const files = await session.sandbox.files.list(path);

  return files.map((f) => ({
    name: f.name,
    type: f.type,
    path: `${path}/${f.name}`,
  }));
};
