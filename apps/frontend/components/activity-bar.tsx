"use client";

import React from "react";
import { Files, Search, GitBranch, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActivityView = "explorer" | "search" | "git" | "settings";

interface ActivityBarProps {
  activeView: ActivityView;
  onViewChange: (view: ActivityView) => void;
}

interface ActivityItemProps {
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  title: string;
}

function ActivityItem({ icon, isActive, onClick, title }: ActivityItemProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "w-12 h-12 flex items-center justify-center text-gray-500 hover:text-white transition-colors relative",
        isActive && "text-white"
      )}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-white rounded-r" />
      )}
      {icon}
    </button>
  );
}

export default function ActivityBar({
  activeView,
  onViewChange,
}: ActivityBarProps) {
  return (
    <div className="w-12 h-full bg-[#333333] flex flex-col items-center py-1 border-r border-[#252526]">
      {/* Top icons */}
      <div className="flex flex-col">
        <ActivityItem
          icon={<Files className="w-6 h-6" />}
          isActive={activeView === "explorer"}
          onClick={() => onViewChange("explorer")}
          title="Explorer (Ctrl+Shift+E)"
        />
        <ActivityItem
          icon={<Search className="w-6 h-6" />}
          isActive={activeView === "search"}
          onClick={() => onViewChange("search")}
          title="Search (Ctrl+Shift+F)"
        />
        <ActivityItem
          icon={<GitBranch className="w-6 h-6" />}
          isActive={activeView === "git"}
          onClick={() => onViewChange("git")}
          title="Source Control (Ctrl+Shift+G)"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom icons */}
      <div className="flex flex-col pb-2">
        <ActivityItem
          icon={<Settings className="w-5 h-5" />}
          isActive={activeView === "settings"}
          onClick={() => onViewChange("settings")}
          title="Settings (Ctrl+,)"
        />
      </div>
    </div>
  );
}
