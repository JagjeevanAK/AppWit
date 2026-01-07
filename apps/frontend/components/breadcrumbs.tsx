"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import { FileIcon } from "@/lib/file-icons";
import { cn } from "@/lib/utils";

interface BreadcrumbsProps {
  filePath?: string;
  onNavigate?: (path: string) => void;
}

export default function Breadcrumbs({
  filePath,
  onNavigate,
}: BreadcrumbsProps) {
  if (!filePath) {
    return (
      <div className="h-[22px] bg-[#1E1E1E] border-b border-[#2B2B2C] px-3 flex items-center">
        <span className="text-xs text-gray-500">No file selected</span>
      </div>
    );
  }

  // Parse the file path into segments
  // Remove common prefixes like /home/user/
  const cleanPath = filePath.replace(/^\/home\/user\//, "");
  const segments = cleanPath.split("/").filter(Boolean);
  const fileName = segments[segments.length - 1];
  const folders = segments.slice(0, -1);

  return (
    <div className="h-[22px] bg-[#1E1E1E] border-b border-[#2B2B2C] px-3 flex items-center overflow-x-auto">
      <div className="flex items-center gap-0.5 text-xs">
        {folders.map((folder, index) => {
          const pathUpToHere = segments.slice(0, index + 1).join("/");
          return (
            <React.Fragment key={pathUpToHere}>
              <button
                onClick={() => onNavigate?.(pathUpToHere)}
                className={cn(
                  "flex items-center gap-1 px-1 py-0.5 rounded hover:bg-[#2A2D2E] text-gray-400 hover:text-white transition-colors"
                )}
              >
                <FileIcon filename={folder} isFolder size={14} />
                <span>{folder}</span>
              </button>
              <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />
            </React.Fragment>
          );
        })}

        {/* Current file */}
        <div className="flex items-center gap-1 px-1 py-0.5 text-gray-300">
          <FileIcon filename={fileName} size={14} />
          <span>{fileName}</span>
        </div>
      </div>
    </div>
  );
}
