"use client"

import {
    ResizablePanelGroup,
    ResizablePanel,
    ResizableHandle,
} from "@/components/ui/resizable"
import ChatBar from "@/components/Chatbar"
import CodeEditor from "@/components/editor"
import { useStream } from "@/hooks/useStream"
import { useParams, useRouter } from "next/navigation"
import { useSandboxHeartbeat } from "@/hooks/useSandboxHeartbeat"
import { useProject } from "@/hooks/useProject"
import { useEffect } from "react"

export default function ProjectPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    const { project, loading, error } = useProject(projectId);
    const streamState = useStream(projectId);

    useSandboxHeartbeat(streamState.sandboxId);

    // Redirect if project not found or unauthorized
    useEffect(() => {
        if (!loading && (error || !project)) {
            router.push("/project");
        }
    }, [loading, error, project, router]);

    if (loading) {
        return (
            <div className="h-screen w-screen bg-[#1D1D1D] flex items-center justify-center">
                <div className="text-white text-xl">Loading project...</div>
            </div>
        );
    }

    if (error || !project) {
        return null; // Will redirect via useEffect
    }

    return (
        <div className="h-screen w-screen bg-[#1D1D1D] flex items-center justify-center">
            <div className="relative w-[calc(100vw-20px)] h-[calc(100vh-20px)]">
                <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={25} minSize={20}>
                        <ChatBar streamState={streamState} initialPrompt={null} />
                    </ResizablePanel>

                    <ResizableHandle isTransparent />

                    <ResizablePanel defaultSize={75} minSize={65}>
                        <CodeEditor streamState={streamState} />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    )
}
