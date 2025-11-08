import { FileNode } from "@/components/file-tree";

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

export function updateFileContent(
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
        children: updateFileContent(node.children, id, content),
      };
    }
    return node;
  });
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

export function getInitialFileTree(): FileNode[] {
  return [
    {
      id: "src",
      name: "src",
      kind: "folder",
      path: "src",
      children: [
        {
          id: "app-tsx",
          name: "App.tsx",
          kind: "file",
          path: "src/App.tsx",
          content: `import React from 'react';

function App() {
  return (
    <div className="App">
      <h1>Hello World</h1>
      <p>Welcome to your code editor!</p>
    </div>
  );
}

export default App;`,
        },
        {
          id: "index-tsx",
          name: "index.tsx",
          kind: "file",
          path: "src/index.tsx",
          content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
        },
        {
          id: "utils",
          name: "utils",
          kind: "folder",
          path: "src/utils",
          children: [
            {
              id: "helpers-ts",
              name: "helpers.ts",
              kind: "file",
              path: "src/utils/helpers.ts",
              content: `export function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}`,
            },
          ],
        },
      ],
    },
    {
      id: "package-json",
      name: "package.json",
      kind: "file",
      path: "package.json",
      content: `{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}`,
    },
    {
      id: "readme-md",
      name: "README.md",
      kind: "file",
      path: "README.md",
      content: `# My Project

This is a sample project with a file tree explorer.

## Features
- File tree navigation
- Code editing with Monaco Editor
- Syntax highlighting
`,
    },
  ];
}
