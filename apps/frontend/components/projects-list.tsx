"use client";

import { useProjects, Project } from "@/hooks/useProjects";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { BackendUrl } from "@/config";
import { toast } from "@/components/ui/sonner";
import Image from "next/image";

type ProjectStatus = "ready" | "backing_up" | "active";

// Number of projects to show in the grid
const PROJECTS_PER_PAGE = 8;

// Thumbnail component with error handling
function ProjectThumbnail({ src, alt }: { src: string; alt: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    // Show placeholder on error
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/5 to-white/10">
        <svg
          className="w-12 h-12 text-white/20"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-cover object-top"
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
      onError={() => setHasError(true)}
    />
  );
}

export function ProjectsList() {
  const { projects, loading, error, deleteProject } = useProjects();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [projectStatuses, setProjectStatuses] = useState<
    Record<string, ProjectStatus>
  >({});

  // Prevent hydration mismatch - only render after client mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check project statuses periodically
  const checkProjectStatuses = useCallback(async () => {
    if (!projects.length) return;

    const token = localStorage.getItem("auth_token");
    const newStatuses: Record<string, ProjectStatus> = {};

    for (const project of projects.slice(0, PROJECTS_PER_PAGE)) {
      try {
        const response = await fetch(
          `${BackendUrl}/prompt/status/${project.id}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        if (response.ok) {
          const data = await response.json();
          newStatuses[project.id] = data.status;
        }
      } catch {
        // Ignore errors, assume ready
        newStatuses[project.id] = "ready";
      }
    }

    setProjectStatuses(newStatuses);
  }, [projects]);

  // Check statuses on mount and periodically
  useEffect(() => {
    if (mounted && projects.length > 0) {
      checkProjectStatuses();
      const interval = setInterval(checkProjectStatuses, 5000); // Check every 5 seconds
      return () => clearInterval(interval);
    }
  }, [mounted, projects.length, checkProjectStatuses]);

  // Return null on server and during initial client render
  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white/50"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return null;
  }

  if (projects.length === 0) {
    return null;
  }

  const handleProjectClick = (project: Project) => {
    const status = projectStatuses[project.id];
    if (status === "backing_up") {
      // Don't navigate - project is being backed up
      return;
    }
    router.push(`/project/${project.id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setConfirmDeleteId(projectId);
  };

  const handleConfirmDelete = async (
    e: React.MouseEvent,
    projectId: string
  ) => {
    e.stopPropagation();
    setDeletingId(projectId);
    try {
      await deleteProject(projectId);
      toast.success("Project deleted successfully");
    } catch (err) {
      console.error("Failed to delete project:", err);
      toast.error("Failed to delete project. Please try again.");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  return (
    <div className="w-full mt-12">
      <h2 className="text-lg font-semibold mb-6 text-white/80">
        Your Projects
      </h2>

      {/* Grid layout: 1 col mobile, 1-2 col tablet, 2 col desktop (larger cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.slice(0, PROJECTS_PER_PAGE).map((project) => {
          const status = projectStatuses[project.id];
          const isBackingUp = status === "backing_up";

          return (
            <div
              key={project.id}
              onClick={() => handleProjectClick(project)}
              className={`group relative flex flex-col rounded-2xl border overflow-hidden transition-all duration-200 ${
                isBackingUp
                  ? "bg-yellow-500/10 border-yellow-500/30 cursor-wait"
                  : "bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 cursor-pointer hover:scale-[1.02]"
              }`}
            >
              {/* Thumbnail Preview - Larger aspect ratio */}
              <div className="relative aspect-[16/10] bg-black/20 overflow-hidden">
                {project.thumbnailUrl ? (
                  <ProjectThumbnail
                    src={project.thumbnailUrl}
                    alt={`${project.name} preview`}
                  />
                ) : (
                  // Placeholder when no thumbnail
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/5 to-white/10">
                    <svg
                      className="w-16 h-16 text-white/20"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}

                {/* Backing up overlay */}
                {isBackingUp && (
                  <div className="absolute inset-0 bg-yellow-500/20 flex items-center justify-center backdrop-blur-sm">
                    <span className="flex items-center gap-2 px-4 py-2 text-base bg-yellow-500/30 text-yellow-200 rounded-full">
                      <svg
                        className="w-5 h-5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Saving...
                    </span>
                  </div>
                )}
              </div>

              {/* Card Footer - Project Name & Actions */}
              <div className="flex items-center justify-between p-4">
                <h3
                  className={`font-medium text-base truncate flex-1 ${
                    isBackingUp ? "text-yellow-200" : "text-white"
                  }`}
                >
                  {project.name}
                </h3>

                {/* Delete Button */}
                {!isBackingUp && (
                  <div className="flex items-center ml-3">
                    {confirmDeleteId === project.id ? (
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => handleConfirmDelete(e, project.id)}
                          disabled={deletingId === project.id}
                          className="px-3 py-1.5 text-sm bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          {deletingId === project.id ? "..." : "Yes"}
                        </button>
                        <button
                          onClick={handleCancelDelete}
                          className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => handleDeleteClick(e, project.id)}
                        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all"
                        title="Delete project"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* View All Button */}
      {projects.length > PROJECTS_PER_PAGE && (
        <button
          onClick={() => router.push("/project")}
          className="w-full mt-8 py-4 text-base text-white/50 hover:text-white/70 transition-colors border border-white/10 rounded-2xl hover:border-white/20 hover:bg-white/5"
        >
          View all {projects.length} projects
        </button>
      )}
    </div>
  );
}
