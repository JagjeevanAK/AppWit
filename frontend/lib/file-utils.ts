import { FileNode } from "@/components/file-tree";

interface SandboxFile {
  name: string;
  type: "file" | "dir";
  path: string;
}

export function findFileById(nodes: FileNode[], id: string): FileNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      const found = findFileById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function inferLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    html: "html",
    css: "css",
    scss: "scss",
    md: "markdown",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    sql: "sql",
    sh: "shell",
  };
  return languageMap[ext || ""] || "plaintext";
}

export function buildFileTreeFromSandbox(files: SandboxFile[], basePath: string = '/home/user'): FileNode[] {
  const tree: FileNode[] = [];
  const pathMap = new Map<string, FileNode>();

  // Sort files to process directories first
  const sortedFiles = [...files].sort((a, b) => {
    if (a.type === 'dir' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'dir') return 1;
    return a.name.localeCompare(b.name);
  });

  for (const file of sortedFiles) {
    const id = file.path.replace(/\//g, '-').replace(/^-/, '');
    const node: FileNode = {
      id,
      name: file.name,
      kind: file.type === 'dir' ? 'folder' : 'file',
      path: file.path,
      children: file.type === 'dir' ? [] : undefined,
    };

    pathMap.set(file.path, node);

    // Determine parent path
    const parentPath = file.path.substring(0, file.path.lastIndexOf('/'));
    
    if (parentPath === basePath || parentPath === '') {
      // Root level file/folder
      tree.push(node);
    } else {
      // Find parent and add as child
      const parent = pathMap.get(parentPath);
      if (parent && parent.children) {
        parent.children.push(node);
      }
    }
  }

  return tree;
}

export async function fetchSandboxFileTree(
  sandboxId: string,
  listFilesFunc: (sandboxId: string, path: string) => Promise<SandboxFile[] | null>,
  basePath: string = '/home/user'
): Promise<FileNode[]> {
  const allFiles: SandboxFile[] = [];
  const dirsToProcess: string[] = [basePath];
  const processedDirs = new Set<string>();

  while (dirsToProcess.length > 0) {
    const currentPath = dirsToProcess.shift()!;
    
    if (processedDirs.has(currentPath)) continue;
    processedDirs.add(currentPath);

    const files = await listFilesFunc(sandboxId, currentPath);
    if (!files) continue;

    for (const file of files) {
      allFiles.push(file);
      
      if (file.type === 'dir') {
        dirsToProcess.push(file.path);
      }
    }
  }

  return buildFileTreeFromSandbox(allFiles, basePath);
}

export async function loadFileContent(
  sandboxId: string,
  filePath: string,
  readFileFunc: (sandboxId: string, path: string) => Promise<string | null>
): Promise<string> {
  const content = await readFileFunc(sandboxId, filePath);
  return content || '// Unable to load file content';
}

export function updateFileNodeWithContent(
  nodes: FileNode[],
  id: string,
  content: string
): FileNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, content };
    }
    if (node.children) {
      return {
        ...node,
        children: updateFileNodeWithContent(node.children, id, content),
      };
    }
    return node;
  });
}
