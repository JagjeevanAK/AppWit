"use client"

import React, { useState } from "react";
import Editor from "@monaco-editor/react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import FileTree, { FileNode } from "@/components/file-tree";
import { findFileById, updateFileContent, inferLanguage, getInitialFileTree } from "@/lib/file-utils";

export default function CodeEditor() {
  const [files, setFiles] = useState<FileNode[]>(getInitialFileTree());
  const [activeFileId, setActiveFileId] = useState<string>("app-tsx");

  const activeFile = findFileById(files, activeFileId);

  const handleFileSelect = (id: string) => {
    const file = findFileById(files, id);
    if (file && file.kind === "file") {
      setActiveFileId(id);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && activeFileId) {
      setFiles((prevFiles) => updateFileContent(prevFiles, activeFileId, value));
    }
  };

  return (
    <ResizablePanelGroup 
      direction="horizontal" 
      className="h-full rounded-lg border border-[#2B2B2C]"
    >
      <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
        <div className="h-full flex flex-col bg-[#1D1D1D]">
          <FileTree
            nodes={files}
            activeId={activeFileId}
            onSelect={handleFileSelect}
          />
        </div>
      </ResizablePanel>

      <ResizableHandle isTransparent />

      <ResizablePanel minSize={50}>
        <div className="h-full flex flex-col">
          {activeFile && (
            <>
              <div className="px-3 py-2 bg-[#1D1D1D] flex items-center gap-2 text-white">
                <span className="text-white">
                  {activeFile.path}
                </span>
              </div>
              <Editor
                key={activeFileId}
                height="100%"
                theme="vs-dark"
                language={inferLanguage(activeFile.name)}
                value={activeFile.content || ""}
                onChange={handleEditorChange}
                path={activeFile.path}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  wordWrap: "on",
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                }}
              />
            </>
          )}
          {!activeFile && (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <p>Select a file to start editing</p>
            </div>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}