"use client"

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProjectLanding() {
    const router = useRouter();

    // Automatically create a new project when user lands here
    useEffect(() => {
        createNewProject();
    }, []);

    const createNewProject = async () => {
        try {
            const token = localStorage.getItem("auth_token");

            if (!token) {
                router.push("/login");
                return;
            }

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/project`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: "Untitled Project"
                })
            });

            if (!response.ok) {
                throw new Error("Failed to create project");
            }

            const { id } = await response.json();
            router.push(`/project/${id}`);
        } catch (error) {
            console.error("Error creating project:", error);
            // Optionally redirect to login or show error
            router.push("/login");
        }
    };

    return (
        <div className="h-screen w-screen bg-[#1D1D1D] flex items-center justify-center">
            <div className="text-white text-xl">Creating new project...</div>
        </div>
    );
}
