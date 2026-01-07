"use client";

import React from "react";
import { GitBranch, Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBarProps {
  fileName?: string;
  language?: string;
  line?: number;
  column?: number;
  encoding?: string;
  indentation?: string;
  isStreaming?: boolean;
  sandboxId?: string | null;
}

export default function StatusBar({
  fileName,
  language = "Plain Text",
  line = 1,
  column = 1,
  encoding = "UTF-8",
  indentation = "Spaces: 2",
  isStreaming = false,
  sandboxId,
}: StatusBarProps) {
  return (
    <div className="h-[22px] bg-[#007ACC] flex items-center justify-between px-2 text-white text-xs select-none">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Git branch (placeholder) */}
        <div className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer">
          <GitBranch className="w-3.5 h-3.5" />
          <span>main</span>
        </div>

        {/* Sync status */}
        {isStreaming ? (
          <div className="flex items-center gap-1.5 px-1.5 py-0.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>AI generating...</span>
          </div>
        ) : sandboxId ? (
          <div className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer">
            <Check className="w-3.5 h-3.5" />
            <span>Synced</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-yellow-200 px-1.5 py-0.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>No sandbox</span>
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1">
        {/* Line and column */}
        <div className="hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer">
          Ln {line}, Col {column}
        </div>

        {/* Indentation */}
        <div className="hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer">
          {indentation}
        </div>

        {/* Encoding */}
        <div className="hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer">
          {encoding}
        </div>

        {/* Language */}
        <div className="hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer">
          {language}
        </div>
      </div>
    </div>
  );
}
