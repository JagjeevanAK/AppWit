"use client";

import { useState, useEffect } from "react";

interface Project {
    id: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
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

export function useProject(projectId: string) {
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!projectId) {
            setLoading(false);
            return;
        }

        const loadProject = async () => {
            try {
                const token = localStorage.getItem("auth_token");

                if (!token) {
                    setError("Not authenticated");
                    setLoading(false);
                    return;
                }

                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/project/${projectId}`,
                    {
                        headers: {
                            "Authorization": `Bearer ${token}`
                        }
                    }
                );

                if (!response.ok) {
                    throw new Error("Failed to load project");
                }

                const data = await response.json();
                setProject(data);
            } catch (err) {
                console.error("Error loading project:", err);
                setError(err instanceof Error ? err.message : "Failed to load project");
            } finally {
                setLoading(false);
            }
        };

        loadProject();
    }, [projectId]);

    return { project, loading, error };
}
