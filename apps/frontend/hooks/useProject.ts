"use client";

import { useQuery } from "@tanstack/react-query";
import { BackendUrl } from "@/config";

interface Project {
    id: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
    r2BackupPath?: string | null;
    lastBackupAt?: string | null;
    chats?: Array<{
        id: string;
        messages: Array<{
            id: string;
            role: string;
            content: string;
            summary: string | null;
            createdAt: string;
        }>;
    }>;
}

async function fetchProject(projectId: string): Promise<Project> {
    const token = localStorage.getItem("auth_token");

    if (!token) {
        throw new Error("Not authenticated");
    }

    const response = await fetch(
        `${BackendUrl}/project/${projectId}`,
        {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Load project failed:", response.status, errorText);
        throw new Error("Failed to load project");
    }

    return response.json();
}

export function useProject(projectId: string) {
    const {
        data: project,
        isLoading: loading,
        error,
    } = useQuery({
        queryKey: ['project', projectId],
        queryFn: () => fetchProject(projectId),
        enabled: !!projectId,
        staleTime: 60000, // Consider data fresh for 1 minute
    });

    return {
        project: project ?? null,
        loading,
        error: error ? (error instanceof Error ? error.message : "Failed to load project") : null
    };
}
