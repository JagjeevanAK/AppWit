"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BackendUrl } from "@/config";

export interface Project {
    id: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
}

async function fetchProjects(): Promise<Project[]> {
    const token = localStorage.getItem("auth_token");

    if (!token) {
        return [];
    }

    const response = await fetch(`${BackendUrl}/project`, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    // Handle auth errors gracefully - don't throw, just return empty projects
    if (response.status === 401 || response.status === 403) {
        return [];
    }

    if (!response.ok) {
        throw new Error("Failed to fetch projects");
    }

    return response.json();
}

async function deleteProjectApi(projectId: string): Promise<void> {
    const token = localStorage.getItem("auth_token");
    if (!token) {
        throw new Error("Not authenticated");
    }

    const response = await fetch(`${BackendUrl}/project/${projectId}`, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error("Failed to delete project");
    }
}

export function useProjects() {
    const queryClient = useQueryClient();

    const {
        data: projects = [],
        isLoading: loading,
        error,
        refetch
    } = useQuery({
        queryKey: ['projects'],
        queryFn: fetchProjects,
        staleTime: 30000, // Consider data fresh for 30 seconds
        refetchOnWindowFocus: true,
    });

    const deleteMutation = useMutation({
        mutationFn: deleteProjectApi,
        onMutate: async (projectId) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['projects'] });

            // Snapshot the previous value
            const previousProjects = queryClient.getQueryData<Project[]>(['projects']);

            // Optimistically update
            queryClient.setQueryData<Project[]>(['projects'], (old) =>
                old?.filter(p => p.id !== projectId) ?? []
            );

            return { previousProjects };
        },
        onError: (err, projectId, context) => {
            // Rollback on error
            if (context?.previousProjects) {
                queryClient.setQueryData(['projects'], context.previousProjects);
            }
        },
        onSettled: () => {
            // Refetch after mutation
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
    });

    const deleteProject = async (projectId: string) => {
        await deleteMutation.mutateAsync(projectId);
        return true;
    };

    return {
        projects,
        loading,
        error: error ? (error instanceof Error ? error.message : "Failed to fetch projects") : null,
        refetch,
        deleteProject
    };
}
