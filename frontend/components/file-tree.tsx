"use client"

import React, { useState } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export type FileNode = {
  id: string;
  name: string;
  kind: "file" | "folder";
  children?: FileNode[];
  content?: string;
  path: string;
};

interface FileTreeProps {
  nodes: FileNode[];
  activeId?: string;
  onSelect: (id: string) => void;
  level?: number;
}

interface FileTreeItemProps {
  node: FileNode;
  activeId?: string;
  onSelect: (id: string) => void;
  level: number;
}

function FileTreeItem({ node, activeId, onSelect, level }: FileTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isActive = activeId === node.id;
  const isFolder = node.kind === "folder";

  const handleClick = () => {
    if (isFolder) {
      setIsExpanded(!isExpanded);
    } else {
      onSelect(node.id);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-[#626261] text-sm text-white",
            isActive && "bg-[#212835] text-white"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {isFolder ? (
          <>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-white" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-white" />
            )}
          </>
        ) : (
          <>
            <span className="w-4" />
            <File className="h-4 w-4 shrink-0 text-white" />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </div>

      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.id}
              node={child}
              activeId={activeId}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ nodes, activeId, onSelect, level = 0 }: FileTreeProps) {
  return (
      <div className="h-full overflow-auto bg-[#1D1D1D]">
      <div className="py-2">
        {nodes.map((node) => (
          <FileTreeItem
            key={node.id}
            node={node}
            activeId={activeId}
            onSelect={onSelect}
            level={level}
          />
        ))}
      </div>
    </div>
  );
}
