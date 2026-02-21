"use client";

import { useState, useRef, useEffect } from "react";
import {
  Download,
  Loader2,
  Eye,
  Terminal,
  PanelLeftOpen,
  PanelLeftClose,
  Rocket,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BackendUrl } from "@/config";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import Logo from "@/components/logo";
import { useDeploy } from "@/hooks/useDeploy";

interface ProjectNavProps {
  projectName?: string;
  onProjectNameChange?: (newName: string) => void;
  sandboxId: string | null;
  projectId: string;
  isStreaming: boolean;
  isChatCollapsed: boolean;
  onToggleChat: () => void;
  activeTab: "preview" | "code";
  onTabChange: (tab: "preview" | "code") => void;
  chatPanelSize: number;
}

export default function ProjectNav({
  projectName,
  onProjectNameChange,
  sandboxId,
  projectId,
  isStreaming,
  isChatCollapsed,
  onToggleChat,
  activeTab,
  onTabChange,
  chatPanelSize,
}: ProjectNavProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(projectName || "");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, signout } = useAuth();
  const router = useRouter();
  const { isDeploying, deploymentUrl, deploy } = useDeploy(projectId);

  // Update editedName when projectName prop changes
  useEffect(() => {
    setEditedName(projectName || "");
  }, [projectName]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNameSubmit = () => {
    if (
      editedName.trim() &&
      editedName !== projectName &&
      onProjectNameChange
    ) {
      onProjectNameChange(editedName.trim());
    } else {
      setEditedName(projectName || "");
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleNameSubmit();
    } else if (e.key === "Escape") {
      setEditedName(projectName || "");
      setIsEditingName(false);
    }
  };

  const handleDownload = async () => {
    if (!sandboxId || isDownloading) return;

    setIsDownloading(true);
    try {
      const response = await fetch(
        `${BackendUrl}/prompt/download/${sandboxId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to download project");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Use project name for the zip file, sanitize for filename
      const safeName = (projectName || "project")
        .replace(/[^a-zA-Z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .toLowerCase()
        .slice(0, 50);
      a.download = `${safeName}.zip`;
      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Failed to download project. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeploy = async () => {
    if (!sandboxId || isDeploying || isStreaming) return;

    try {
      const result = await deploy();
      if (result?.deploymentUrl) {
        toast.success(
          result.isRedeploy
            ? "Redeployed successfully!"
            : "Deployed to Vercel!",
          { description: result.deploymentUrl }
        );
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Deployment failed. Please try again.";
      toast.error(message);
    }
  };

  // Get user initials for avatar
  const getInitials = () => {
    if (user?.name) {
      return user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email[0]?.toUpperCase() ?? "U";
    }
    return "U";
  };

  return (
    <nav className="w-full bg-sidebar px-4 py-2">
      <div className="flex items-center">
        {/* Left side - Logo + Project Name + Collapse Button (takes up chat panel width) */}
        <div
          className="flex items-center gap-2 shrink-0 pr-4"
          style={{ width: isChatCollapsed ? "auto" : `${chatPanelSize}%` }}
        >
          {/* Logo - clickable to navigate to dashboard */}
          <button
            onClick={() => router.push("/")}
            className="shrink-0 hover:opacity-80 transition-opacity flex items-center cursor-pointer"
            title="Go to dashboard"
          >
            <Logo className="w-6 h-6 text-white" />
          </button>

          {/* Breadcrumb separator */}
          <span className="text-gray-500 text-xl leading-none shrink-0">/</span>

          {/* Project Name */}
          <div className="min-w-0 flex-1 flex items-center">
            {isEditingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={handleNameKeyDown}
                className="bg-transparent text-white text-base font-medium outline-none border-b border-white/30 pb-0.5"
                placeholder="Project name"
              />
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="text-left group flex items-center gap-2"
                title="Click to rename project"
              >
                <span className="text-base font-medium text-white truncate max-w-[200px]">
                  {projectName || "Untitled Project"}
                </span>
                <svg
                  className="w-3.5 h-3.5 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Collapse/Expand Button - on chat side of handle */}
          <button
            onClick={onToggleChat}
            className="flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground hover:text-foreground hover:bg-accent transition-all shrink-0"
            title={isChatCollapsed ? "Expand chat" : "Collapse chat"}
          >
            {isChatCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Preview/Code Toggle - on editor side of handle */}
        <div
          className={cn(
            "flex items-center gap-2",
            isChatCollapsed ? "ml-2" : "ml-2"
          )}
        >
          <div className="flex items-center bg-muted rounded-xl p-0.5">
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 text-sm rounded-lg transition-all duration-200",
                activeTab === "preview"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
              onClick={() => onTabChange("preview")}
            >
              <Eye className="h-4 w-4" />
              <span>Preview</span>
            </button>
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 text-sm rounded-lg transition-all duration-200",
                activeTab === "code"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
              onClick={() => onTabChange("code")}
            >
              <Terminal className="h-4 w-4" />
              <span>Code</span>
            </button>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side - Deploy + Download + Profile */}
        <div className="flex items-center gap-2">
          {/* Deploy Button */}
          <button
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl transition-all duration-200",
              "bg-blue-600 text-white hover:bg-blue-700",
              (isDeploying || isStreaming) && "opacity-50 cursor-not-allowed",
              !sandboxId && "opacity-30 cursor-not-allowed"
            )}
            onClick={handleDeploy}
            disabled={!sandboxId || isDeploying || isStreaming}
            title={
              isStreaming
                ? "Wait for generation to complete"
                : sandboxId
                  ? "Deploy to Vercel"
                  : "Waiting for sandbox..."
            }
          >
            {isDeploying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {deploymentUrl ? "Redeploy" : "Deploy"}
            </span>
          </button>

          {/* Deployment URL */}
          {deploymentUrl && !isDeploying && (
            <a
              href={deploymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 text-xs text-green-400 hover:text-green-300 transition-colors"
              title={deploymentUrl}
            >
              <ExternalLink className="h-3 w-3" />
              <span className="hidden md:inline">Live</span>
            </a>
          )}

          {/* Download Button */}
          <button
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl transition-all duration-200",
              "bg-white text-black hover:bg-gray-200",
              isDownloading && "opacity-50 cursor-not-allowed",
              !sandboxId && "opacity-30 cursor-not-allowed"
            )}
            onClick={handleDownload}
            disabled={!sandboxId || isDownloading}
            title={
              sandboxId
                ? "Download project as archive"
                : "Waiting for sandbox..."
            }
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Download</span>
          </button>

          {/* Profile Button */}
          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-black text-sm font-medium hover:ring-2 hover:ring-white/30 transition-all"
              >
                {getInitials()}
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-black border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                  {/* User Info */}
                  <div className="px-4 py-3">
                    <p className="text-sm font-medium text-white truncate">
                      {user.name || "User"}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {user.email}
                    </p>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        router.push("/projects");
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-3"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      </svg>
                      My Projects
                    </button>
                  </div>

                  {/* Logout */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        signout();
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-3"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
