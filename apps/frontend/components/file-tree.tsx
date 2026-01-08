"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Search,
  MoreHorizontal,
  RefreshCw,
  FolderPlus,
  FilePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FileIcon } from "@/lib/file-icons";

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
  openTabs?: string[];
  projectName?: string;
}

interface FileTreeItemProps {
  node: FileNode;
  activeId?: string;
  onSelect: (id: string) => void;
  level: number;
  searchQuery?: string;
}

interface SectionHeaderProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
}

function SectionHeader({
  title,
  isExpanded,
  onToggle,
  actions,
}: SectionHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:bg-popover cursor-pointer select-none group"
      onClick={onToggle}
    >
      <div className="flex items-center gap-1">
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span>{title}</span>
      </div>
      {actions && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {actions}
        </div>
      )}
    </div>
  );
}

function nodeMatchesSearch(node: FileNode, query: string): boolean {
  if (!query) return true;

  const lowerQuery = query.toLowerCase();

  if (node.name.toLowerCase().includes(lowerQuery)) {
    return true;
  }

  if (node.children) {
    return node.children.some((child) => nodeMatchesSearch(child, query));
  }

  return false;
}

// Check if a folder contains the active file (directly or nested)
function folderContainsActiveFile(
  node: FileNode,
  activeId: string | undefined
): boolean {
  if (!activeId || node.kind !== "folder" || !node.children) return false;

  for (const child of node.children) {
    if (child.id === activeId) return true;
    if (child.kind === "folder" && folderContainsActiveFile(child, activeId)) {
      return true;
    }
  }
  return false;
}

function FileTreeItem({
  node,
  activeId,
  onSelect,
  level,
  searchQuery = "",
}: FileTreeItemProps) {
  // Auto-expand folders that contain the active file
  const containsActiveFile = useMemo(() => {
    return folderContainsActiveFile(node, activeId);
  }, [node, activeId]);

  // Track if user has manually toggled this folder
  const [userToggled, setUserToggled] = useState(false);
  const [isExpanded, setIsExpanded] = useState(containsActiveFile);

  // Track the previous activeId to detect when it changes
  const prevActiveIdRef = React.useRef(activeId);

  // Only auto-expand when activeId changes to a file inside this folder
  // Don't auto-expand on every re-render/refresh if user manually collapsed it
  React.useEffect(() => {
    const activeIdChanged = prevActiveIdRef.current !== activeId;
    prevActiveIdRef.current = activeId;

    // Only auto-expand if activeId changed and this folder contains the new active file
    // Respect user's manual toggle otherwise
    if (activeIdChanged && containsActiveFile && !isExpanded) {
      setIsExpanded(true);
      setUserToggled(false); // Reset user toggle when we auto-expand for new active file
    }
  }, [activeId, containsActiveFile, isExpanded]);

  const isActive = activeId === node.id;
  const isFolder = node.kind === "folder";

  const shouldShow = nodeMatchesSearch(node, searchQuery);

  if (!shouldShow) return null;

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
          "flex items-center gap-1 py-[3px] cursor-pointer text-[13px] transition-colors",
          "hover:bg-popover",
          isActive ? "bg-accent text-foreground" : "text-foreground"
        )}
        style={{ paddingLeft: `${level * 8 + 12}px`, paddingRight: "8px" }}
        onClick={handleClick}
      >
        {isFolder ? (
          <>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
            )}
            <FileIcon
              filename={node.name}
              isFolder
              isOpen={isExpanded}
              size={16}
            />
          </>
        ) : (
          <>
            <span className="w-4 shrink-0" />
            <FileIcon filename={node.name} size={16} />
          </>
        )}
        <span className="truncate ml-0.5">{node.name}</span>
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
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Open Editors Section
interface OpenEditorsProps {
  openTabs: string[];
  activeId?: string;
  files: FileNode[];
  onSelect: (id: string) => void;
}

function findFileById(nodes: FileNode[], id: string): FileNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findFileById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function OpenEditors({
  openTabs,
  activeId,
  files,
  onSelect,
}: OpenEditorsProps) {
  if (openTabs.length === 0) return null;

  return (
    <div className="py-1">
      {openTabs.map((tabId) => {
        const file = findFileById(files, tabId);
        if (!file) return null;
        const isActive = tabId === activeId;

        return (
          <div
            key={tabId}
            onClick={() => onSelect(tabId)}
            className={cn(
              "flex items-center gap-1 py-[3px] px-3 cursor-pointer text-[13px] transition-colors",
              "hover:bg-[#2A2D2E]",
              isActive ? "bg-[#094771] text-white" : "text-[#CCCCCC]"
            )}
          >
            <FileIcon filename={file.name} size={16} />
            <span className="truncate ml-0.5">{file.name}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function FileTree({
  nodes,
  activeId,
  onSelect,
  level = 0,
  openTabs = [],
  projectName = "PROJECT",
}: FileTreeProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showOpenEditors, setShowOpenEditors] = useState(true);
  const [showExplorer, setShowExplorer] = useState(true);

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Search Input */}
      <div className="px-2 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-muted text-foreground text-xs pl-7 pr-2 py-1 rounded border border-transparent focus:border-ring focus:outline-none placeholder-muted-foreground"
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto">
        {/* Open Editors Section */}
        {openTabs.length > 0 && (
          <>
            <SectionHeader
              title="Open Editors"
              isExpanded={showOpenEditors}
              onToggle={() => setShowOpenEditors(!showOpenEditors)}
            />
            {showOpenEditors && (
              <OpenEditors
                openTabs={openTabs}
                activeId={activeId}
                files={nodes}
                onSelect={onSelect}
              />
            )}
          </>
        )}

        {/* Explorer Section */}
        <SectionHeader
          title={projectName}
          isExpanded={showExplorer}
          onToggle={() => setShowExplorer(!showExplorer)}
          actions={
            <>
              <button
                className="p-0.5 hover:bg-muted rounded"
                title="New File"
              >
                <FilePlus className="h-3.5 w-3.5 text-gray-400 hover:text-white" />
              </button>
              <button
                className="p-0.5 hover:bg-muted rounded"
                title="New Folder"
              >
                <FolderPlus className="h-3.5 w-3.5 text-gray-400 hover:text-white" />
              </button>
              <button
                className="p-0.5 hover:bg-muted rounded"
                title="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5 text-gray-400 hover:text-white" />
              </button>
            </>
          }
        />
        {showExplorer && (
          <div className="pb-4">
            {nodes.map((node) => (
              <FileTreeItem
                key={node.id}
                node={node}
                activeId={activeId}
                onSelect={onSelect}
                level={level}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
