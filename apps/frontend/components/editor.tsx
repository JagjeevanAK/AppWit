"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Editor from "@monaco-editor/react";
import { X } from "lucide-react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import FileTree, { FileNode } from "@/components/file-tree";
import {
  findFileById,
  inferLanguage,
  fetchSandboxFileTree,
  loadFileContent,
  updateFileNodeWithContent,
  mergeFileTrees,
} from "@/lib/file-utils";
import { cn } from "@/lib/utils";
import { FileIcon } from "@/lib/file-icons";
import Preview from "./preview";
import Breadcrumbs from "./breadcrumbs";
import StatusBar from "./status-bar";
import { useSandboxFiles } from "@/hooks/useSandboxFiles";
import type { FileChange } from "@/hooks/useStream";

// Language display names
const languageDisplayNames: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  markdown: "Markdown",
  yaml: "YAML",
  xml: "XML",
  sql: "SQL",
  shell: "Shell Script",
  python: "Python",
  rust: "Rust",
  go: "Go",
  java: "Java",
  plaintext: "Plain Text",
};

interface CodeEditorProps {
  streamState: {
    data: string;
    isStreaming: boolean;
    error: string | null;
    sandboxUrl: string | null;
    sandboxId: string | null;
    fileChanges: FileChange[];
    startStream: (prompt: string, backendUrl?: string) => Promise<void>;
    stopStream: () => void;
    resetStream: () => void;
    clearFileChanges: () => void;
  };
  activeTab: "preview" | "code";
}

export default function CodeEditor({
  streamState,
  activeTab,
}: CodeEditorProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>("");
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const { sandboxUrl, sandboxId, isStreaming, fileChanges, clearFileChanges } =
    streamState;
  const { listFiles, readFile } = useSandboxFiles();
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const processedChangesRef = useRef<number>(0);
  const editorRef = useRef<any>(null);

  // Find app/page.tsx specifically, fallback to first file
  const findAppPageFile = useCallback((nodes: FileNode[]): FileNode | null => {
    // First pass: look for app/page.tsx
    const findPageTsx = (nodes: FileNode[]): FileNode | null => {
      for (const node of nodes) {
        if (node.kind === "file" && node.path.endsWith("app/page.tsx")) {
          return node;
        }
        if (node.children) {
          const found = findPageTsx(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const pageTsx = findPageTsx(nodes);
    if (pageTsx) return pageTsx;

    // Fallback: return first file found
    const findFirstFile = (nodes: FileNode[]): FileNode | null => {
      for (const node of nodes) {
        if (node.kind === "file") return node;
        if (node.children) {
          const found = findFirstFile(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    return findFirstFile(nodes);
  }, []);

  const loadSandboxFiles = useCallback(
    async (isRefetch = false) => {
      if (!sandboxId) {
        console.log("No sandboxId available yet");
        return;
      }

      if (!isRefetch) {
        setIsLoadingFiles(true);
      }

      console.log(
        isRefetch
          ? "Refetching files from sandbox:"
          : "Starting to load files from sandbox:",
        sandboxId
      );

      try {
        const fileTree = await fetchSandboxFileTree(sandboxId, listFiles);
        console.log("Fetched file tree:", fileTree);

        if (fileTree && fileTree.length > 0) {
          setFiles((prevFiles) => {
            if (isRefetch && prevFiles.length > 0) {
              return mergeFileTrees(prevFiles, fileTree);
            }
            return fileTree;
          });
          console.log("Files set, count:", fileTree.length);

          if (!isRefetch && !hasInitialLoad) {
            const defaultFile = findAppPageFile(fileTree);
            if (defaultFile) {
              console.log(
                "Default file found:",
                defaultFile.name,
                defaultFile.path
              );
              setOpenTabs([defaultFile.id]);
              setActiveFileId(defaultFile.id);
            }
            setHasInitialLoad(true);
          } else if (isRefetch && activeFileId) {
            // Reload content for currently active file
            console.log("Reloading content for active file:", activeFileId);
            const activeFile = findFileById(fileTree, activeFileId);
            if (activeFile && activeFile.kind === "file") {
              try {
                const content = await loadFileContent(
                  sandboxId,
                  activeFile.path,
                  readFile
                );
                setFiles((prevFiles) =>
                  updateFileNodeWithContent(prevFiles, activeFileId, content)
                );
                console.log("Active file content reloaded smoothly");
              } catch (error) {
                console.error("Error reloading active file:", error);
              }
            }
          }
        } else {
          console.log("File tree is empty or null");
        }
      } catch (error) {
        console.error("Error loading sandbox files:", error);
      } finally {
        if (!isRefetch) {
          console.log("Setting isLoadingFiles to false");
          setIsLoadingFiles(false);
        }
      }
    },
    [
      sandboxId,
      listFiles,
      findAppPageFile,
      hasInitialLoad,
      activeFileId,
      readFile,
    ]
  );

  useEffect(() => {
    if (sandboxId && !hasInitialLoad) {
      loadSandboxFiles(false);
    }
  }, [sandboxId, hasInitialLoad, loadSandboxFiles]);

  useEffect(() => {
    if (!sandboxId || !hasInitialLoad || fileChanges.length === 0) {
      return;
    }

    const newChanges = fileChanges.slice(processedChangesRef.current);
    if (newChanges.length === 0) return;

    processedChangesRef.current = fileChanges.length;

    const processChanges = async () => {
      for (const change of newChanges) {
        console.log("Live file update:", change.action, change.path);

        if (change.action === "create" || change.action === "update") {
          try {
            const content = await readFile(sandboxId, change.path);
            if (content) {
              setFiles((prevFiles) => {
                const existingFile = findFileById(prevFiles, change.path);
                if (existingFile) {
                  return updateFileNodeWithContent(
                    prevFiles,
                    change.path,
                    content
                  );
                }
                return prevFiles;
              });
            }
          } catch (error) {
            console.error("Error fetching updated file:", error);
          }
        }
      }

      await loadSandboxFiles(true);
    };

    processChanges();
  }, [fileChanges, sandboxId, hasInitialLoad, loadSandboxFiles, readFile]);

  useEffect(() => {
    if (!isStreaming || !sandboxId || !hasInitialLoad) {
      return;
    }

    const pollInterval = setInterval(() => {
      loadSandboxFiles(true);
    }, 3000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [isStreaming, sandboxId, hasInitialLoad, loadSandboxFiles]);

  useEffect(() => {
    if (!isStreaming && hasInitialLoad && sandboxId) {
      console.log("Streaming completed, final refetch...");
      loadSandboxFiles(true);
      processedChangesRef.current = 0;
      clearFileChanges();
    }
  }, [
    isStreaming,
    hasInitialLoad,
    sandboxId,
    loadSandboxFiles,
    clearFileChanges,
  ]);

  const activeFile = findFileById(files, activeFileId);
  const activeLanguage = activeFile
    ? inferLanguage(activeFile.name)
    : "plaintext";
  const activeLanguageDisplay =
    languageDisplayNames[activeLanguage] || activeLanguage;

  const handleFileSelect = async (id: string) => {
    const file = findFileById(files, id);
    console.log("File selected:", {
      id,
      file,
      hasContent: !!file?.content,
      sandboxId,
    });

    if (file && file.kind === "file") {
      if (!openTabs.includes(id)) {
        setOpenTabs([...openTabs, id]);
      }
      setActiveFileId(id);

      if (!file.content && sandboxId) {
        console.log("Loading content for file:", file.path);
        try {
          const content = await loadFileContent(sandboxId, file.path, readFile);
          console.log("Content loaded, length:", content?.length);
          setFiles((prevFiles) =>
            updateFileNodeWithContent(prevFiles, id, content)
          );
        } catch (error) {
          console.error("Error loading file content:", error);
        }
      } else {
        console.log("File already has content or no sandboxId");
      }
    }
  };

  const handleTabClose = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const newOpenTabs = openTabs.filter((tabId) => tabId !== id);
    setOpenTabs(newOpenTabs);

    if (id === activeFileId) {
      if (newOpenTabs.length > 0) {
        setActiveFileId(newOpenTabs[newOpenTabs.length - 1]);
      } else {
        setActiveFileId("");
      }
    }
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e: any) => {
      setCursorPosition({
        line: e.position.lineNumber,
        column: e.position.column,
      });
    });
  };

  return (
    <div className="h-full flex flex-col bg-card rounded-2xl overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === "preview" ? (
          <Preview preview_url={sandboxUrl} isStreaming={isStreaming} />
        ) : (
          <>
            {/* Editor Layout */}
            <ResizablePanelGroup direction="horizontal" className="flex-1">
              {/* Sidebar */}
              <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
                <div className="h-full flex flex-col bg-card">
                  {isLoadingFiles ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center space-y-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-primary mx-auto"></div>
                        <p className="text-sm">Loading files...</p>
                      </div>
                    </div>
                  ) : files.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-400">
                      <div className="text-center space-y-2 px-4">
                        <p className="text-sm">No files available</p>
                        <p className="text-xs text-gray-500">
                          Send a prompt to generate code
                        </p>
                      </div>
                    </div>
                  ) : (
                    <FileTree
                      nodes={files}
                      activeId={activeFileId}
                      onSelect={handleFileSelect}
                      openTabs={openTabs}
                      projectName="Explorer"
                    />
                  )}
                </div>
              </ResizablePanel>

              <ResizableHandle isTransparent />

              {/* Editor Panel */}
              <ResizablePanel defaultSize={80} minSize={50}>
                <div className="h-full flex flex-col">
                  {/* Tabs Bar */}
                  <div className="flex items-center bg-card border-b border-border overflow-x-auto min-h-[35px]">
                    {openTabs.length > 0 ? (
                      openTabs.map((tabId) => {
                        const tabFile = findFileById(files, tabId);
                        if (!tabFile) return null;

                        const isActive = tabId === activeFileId;

                        return (
                          <div
                            key={tabId}
                            onClick={() => setActiveFileId(tabId)}
                            className={cn(
                              "flex items-center gap-2 px-3 h-[35px] text-[13px] cursor-pointer border-r border-card group min-w-fit transition-colors",
                              isActive
                                ? "bg-background text-foreground border-t-2 border-t-primary"
                                : "bg-muted text-muted-foreground hover:bg-muted/80 border-t-2 border-t-transparent"
                            )}
                          >
                            <FileIcon filename={tabFile.name} size={16} />
                            <span className="truncate max-w-[120px]">
                              {tabFile.name}
                            </span>
                            <button
                              onClick={(e) => handleTabClose(tabId, e)}
                              className={cn(
                                "shrink-0 hover:bg-muted rounded p-0.5 transition-opacity",
                                isActive
                                  ? "opacity-100"
                                  : "opacity-0 group-hover:opacity-100"
                              )}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-gray-500 text-sm">
                        No files open
                      </div>
                    )}
                  </div>

                  {/* Breadcrumbs */}
                  {activeFile && <Breadcrumbs filePath={activeFile.path} />}

                  {/* Editor Area */}
                  {activeFile && (
                    <div className="flex-1 overflow-hidden">
                      <Editor
                        key={activeFileId}
                        height="100%"
                        theme="vs-dark"
                        language={activeLanguage}
                        value={activeFile.content || ""}
                        path={activeFile.path}
                        onMount={handleEditorDidMount}
                        options={{
                          fontSize: 14,
                          fontFamily:
                            "'Fira Code', 'Cascadia Code', Consolas, monospace",
                          minimap: { enabled: false },
                          wordWrap: "on",
                          automaticLayout: true,
                          scrollBeyondLastLine: false,
                          readOnly: true,
                          smoothScrolling: true,
                          cursorSmoothCaretAnimation: "on",
                          renderLineHighlight: "all",
                          renderWhitespace: "none",
                          lineNumbers: "on",
                          glyphMargin: false,
                          folding: true,
                          lineDecorationsWidth: 10,
                          lineNumbersMinChars: 3,
                          padding: { top: 8 },
                        }}
                        loading={
                          <div className="h-full flex items-center justify-center bg-background">
                            <div className="animate-pulse text-gray-400">
                              Loading content...
                            </div>
                          </div>
                        }
                      />
                    </div>
                  )}

                  {/* Empty State */}
                  {!activeFile && openTabs.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-background">
                      <div className="text-center space-y-4">
                        <div className="text-6xl opacity-20">{ }</div>
                        <p className="text-lg">No file selected</p>
                        <p className="text-sm text-gray-600">
                          Select a file from the explorer to view its contents
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </>
        )}
      </div>
    </div>
  );
}
