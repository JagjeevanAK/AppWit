"use client";

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import ChatBar from "@/components/Chatbar";
import CodeEditor from "@/components/editor";
import { useStream } from "@/hooks/useStream";
import { useParams, useRouter } from "next/navigation";
import { useSandboxHeartbeat } from "@/hooks/useSandboxHeartbeat";
import { useProject } from "@/hooks/useProject";
import { useEffect, useState, useRef, useCallback } from "react";
import { BackendUrl } from "@/config";
import type { ImperativePanelHandle } from "react-resizable-panels";
import ProjectNav from "@/components/project-nav";
import { Loader } from "@/components/ui/loader";

interface ChatMessage {
  content: string;
  type: "user" | "response";
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const { project, loading, error, updateProjectName } = useProject(projectId);
  const streamState = useStream(projectId);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const [initialTheme, setInitialTheme] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const hasNotifiedLeaving = useRef(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [chatPanelSize, setChatPanelSize] = useState(25);
  const chatPanelRef = useRef<ImperativePanelHandle>(null);

  // Track if the initial orchestration has completed
  const [isInitialOrchestrationComplete, setIsInitialOrchestrationComplete] =
    useState(false);
  const hasStartedInitialStream = useRef(false);
  const hasLoadedExistingProject = useRef(false);
  const [loadingStatus, setLoadingStatus] =
    useState<string>("Loading project...");
  const [isResurrecting, setIsResurrecting] = useState(false);

  // Handle sandbox resurrection when it gets killed while page is open
  const handleSandboxResurrection = useCallback(async () => {
    if (isResurrecting) {
      console.log("[PAGE] Already resurrecting, skipping");
      return;
    }

    console.log("[PAGE] Sandbox died, attempting resurrection...");
    setIsResurrecting(true);
    setLoadingStatus("Reconnecting to sandbox...");

    try {
      const token = localStorage.getItem("auth_token");
      const loadResponse = await fetch(`${BackendUrl}/prompt/load/${projectId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (loadResponse.ok) {
        const data = await loadResponse.json();
        console.log("[PAGE] Sandbox resurrected:", data);
        if (data.sandboxUrl && data.sandboxId) {
          streamState.setSandbox(data.sandboxUrl, data.sandboxId);
        }
      } else {
        console.error("[PAGE] Failed to resurrect sandbox:", loadResponse.status);
      }
    } catch (err) {
      console.error("[PAGE] Error resurrecting sandbox:", err);
    } finally {
      setIsResurrecting(false);
    }
  }, [projectId, isResurrecting, streamState]);

  useSandboxHeartbeat(streamState.sandboxId, {
    onSandboxDead: handleSandboxResurrection,
  });

  // Handle initial prompt or load existing project
  useEffect(() => {
    const pendingPrompt = localStorage.getItem("pendingPrompt");

    console.log("[PAGE] useEffect triggered:", {
      pendingPrompt: !!pendingPrompt,
      projectId,
      r2BackupPath: project?.r2BackupPath,
      loading,
      hasLoaded: hasLoadedExistingProject.current,
    });

    // Wait for project data to load
    if (loading) {
      return;
    }

    if (pendingPrompt) {
      // NEW project with a prompt - let ChatBar handle the streaming
      setInitialPrompt(pendingPrompt);
      const theme = localStorage.getItem("pendingTheme");
      if (theme) {
        setInitialTheme(theme);
        localStorage.removeItem("pendingTheme");
      }
      localStorage.removeItem("pendingPrompt");
      hasStartedInitialStream.current = true;
      setLoadingStatus("Building your application...");
      // Allow ChatBar to render so it can trigger the stream
      setIsInitialOrchestrationComplete(true);
    } else if (
      !hasLoadedExistingProject.current &&
      projectId &&
      project?.r2BackupPath
    ) {
      // EXISTING project with R2 backup - load from R2
      console.log(
        "[PAGE] Loading existing project from R2:",
        project.r2BackupPath
      );
      hasLoadedExistingProject.current = true;
      setLoadingStatus("Restoring your project...");

      const loadProject = async () => {
        try {
          const token = localStorage.getItem("auth_token");
          console.log("[PAGE] Calling /prompt/load/", projectId);

          // Load project and fetch messages in parallel
          const [loadResponse, messagesResponse] = await Promise.all([
            fetch(`${BackendUrl}/prompt/load/${projectId}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            }),
            fetch(`${BackendUrl}/prompt/messages/${projectId}`, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            }),
          ]);

          if (loadResponse.ok) {
            const data = await loadResponse.json();
            console.log("[PAGE] Project loaded:", data);
            if (data.sandboxUrl && data.sandboxId) {
              streamState.setSandbox(data.sandboxUrl, data.sandboxId);
            }
          } else {
            console.error(
              "[PAGE] Failed to load project:",
              loadResponse.status
            );
          }

          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json();
            console.log(
              "[PAGE] Chat messages loaded:",
              messagesData.messages?.length || 0
            );
            if (messagesData.messages && messagesData.messages.length > 0) {
              setInitialMessages(messagesData.messages);
            }
          } else {
            console.error(
              "[PAGE] Failed to load messages:",
              messagesResponse.status
            );
          }
        } catch (err) {
          console.error("[PAGE] Error loading project:", err);
        }
        setIsInitialOrchestrationComplete(true);
      };

      loadProject();
    } else if (
      !hasLoadedExistingProject.current &&
      projectId &&
      !project?.r2BackupPath
    ) {
      // EXISTING project without R2 backup - try to reconnect to sandbox anyway
      // The sandbox might still be alive even though backup didn't complete
      console.log("[PAGE] Project has no R2 backup, attempting to load sandbox anyway");
      hasLoadedExistingProject.current = true;
      setLoadingStatus("Connecting to sandbox...");

      const tryLoadSandbox = async () => {
        try {
          const token = localStorage.getItem("auth_token");
          console.log("[PAGE] Calling /prompt/load/ for project without backup:", projectId);

          const loadResponse = await fetch(`${BackendUrl}/prompt/load/${projectId}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });

          if (loadResponse.ok) {
            const data = await loadResponse.json();
            console.log("[PAGE] Sandbox loaded:", data);
            if (data.sandboxUrl && data.sandboxId) {
              streamState.setSandbox(data.sandboxUrl, data.sandboxId);
            }
          } else {
            console.log("[PAGE] No active sandbox found, showing empty editor");
          }
        } catch (err) {
          console.error("[PAGE] Error loading sandbox:", err);
        }
        setIsInitialOrchestrationComplete(true);
      };

      tryLoadSandbox();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, project, loading]);

  // Mark initial orchestration as complete when streaming finishes
  useEffect(() => {
    if (
      hasStartedInitialStream.current &&
      !streamState.isStreaming &&
      streamState.sandboxUrl
    ) {
      setIsInitialOrchestrationComplete(true);
    }
  }, [streamState.isStreaming, streamState.sandboxUrl]);

  // Update project name when LLM generates one
  useEffect(() => {
    if (streamState.generatedProjectName) {
      console.log("[PAGE] Received generated project name:", streamState.generatedProjectName);
      updateProjectName(streamState.generatedProjectName);
    }
  }, [streamState.generatedProjectName, updateProjectName]);

  useEffect(() => {
    const sandboxId = streamState.sandboxId;
    console.log("[PAGE] sandboxId changed:", sandboxId);

    if (!sandboxId) {
      console.log("[PAGE] No sandboxId, skipping notify-leaving setup");
      return;
    }

    // Store sandboxId at window level for access during page unload
    // This is important because React component may unmount before we can access state
    (window as any).__currentSandboxId = sandboxId;
    (window as any).__hasNotifiedLeaving = false;

    console.log("[PAGE] Setting up leave listeners for sandbox:", sandboxId);

    const notifyLeaving = () => {
      const currentSandboxId = (window as any).__currentSandboxId;
      const hasNotified = (window as any).__hasNotifiedLeaving;

      if (hasNotified || !currentSandboxId) {
        console.log("[PAGE] Already notified or no sandboxId, skipping");
        return;
      }
      (window as any).__hasNotifiedLeaving = true;

      console.log(
        "[PAGE] Sending notify-leaving for sandbox:",
        currentSandboxId
      );

      const url = `${BackendUrl}/prompt/notify-leaving/${currentSandboxId}`;
      const data = JSON.stringify({ timestamp: Date.now() });
      const blob = new Blob([data], { type: "application/json" });

      // Use sendBeacon for reliable delivery during page unload
      const sent = navigator.sendBeacon(url, blob);
      console.log("[PAGE] sendBeacon result:", sent ? "sent" : "failed");

      if (!sent) {
        // Fallback: try with XMLHttpRequest (synchronous) for more reliability
        try {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", url, false); // false = synchronous
          xhr.setRequestHeader("Content-Type", "application/json");
          xhr.send(data);
          console.log("[PAGE] XHR fallback completed");
        } catch (err) {
          console.error("[PAGE] XHR fallback failed:", err);
        }
      }
    };

    // Only use pagehide/beforeunload for tab/browser close
    window.addEventListener("pagehide", notifyLeaving);
    window.addEventListener("beforeunload", notifyLeaving);

    // Track tab visibility changes - notify backend when tab is hidden
    const handleVisibilityChange = () => {
      const currentSandboxId = (window as any).__currentSandboxId;
      if (!currentSandboxId) {
        console.log("[PAGE] No sandboxId for visibility change, skipping");
        return;
      }
      const isHidden = document.visibilityState === "hidden";
      const visibilityUrl = `${BackendUrl}/prompt/visibility/${currentSandboxId}`;

      // Use sendBeacon for hidden, fetch for visible (because we need to cancel timer)
      if (isHidden) {
        console.log("[PAGE] Tab hidden, notifying backend");
        const blob = new Blob([JSON.stringify({ isHidden: true })], {
          type: "application/json",
        });
        navigator.sendBeacon(visibilityUrl, blob);
      } else {
        console.log("[PAGE] Tab visible, notifying backend");
        fetch(visibilityUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isHidden: false }),
        }).catch((err) =>
          console.error("[PAGE] Visibility notify failed:", err)
        );
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      console.log("[PAGE] Cleanup: removing listeners and notifying");
      window.removeEventListener("pagehide", notifyLeaving);
      window.removeEventListener("beforeunload", notifyLeaving);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // Notify on component unmount (route change within app)
      notifyLeaving();
    };
  }, [streamState.sandboxId]);

  useEffect(() => {
    if (!loading && (error || !project)) {
      router.push("/project");
    }
  }, [loading, error, project, router]);

  // Show loader while project data is loading
  if (loading) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <Loader size="lg" text="Loading project..." />
      </div>
    );
  }

  if (error || !project) {
    return null;
  }

  // Show full-page loader during initial orchestration or project loading
  if (!isInitialOrchestrationComplete) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center gap-6">
        {/* Loading animation */}
        <Loader size="lg" />

        {/* Status text */}
        <div className="text-center space-y-2">
          <div className="text-foreground text-xl font-medium">{loadingStatus}</div>
          <div className="text-muted-foreground text-sm">This may take a moment...</div>
        </div>

        {/* Progress dots */}
        <div className="flex space-x-2">
          <div
            className="w-2 h-2 bg-primary rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          ></div>
          <div
            className="w-2 h-2 bg-primary rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          ></div>
          <div
            className="w-2 h-2 bg-primary rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          ></div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return null;
  }

  // Show full-page loader during initial orchestration or project loading
  if (!isInitialOrchestrationComplete) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center gap-6">
        {/* Loading animation */}
        <Loader size="lg" />

        {/* Status text */}
        <div className="text-center space-y-2">
          <div className="text-foreground text-xl font-medium">{loadingStatus}</div>
          <div className="text-muted-foreground text-sm">This may take a moment...</div>
        </div>

        {/* Progress dots */}
        <div className="flex space-x-2">
          <div
            className="w-2 h-2 bg-primary rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          ></div>
          <div
            className="w-2 h-2 bg-primary rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          ></div>
          <div
            className="w-2 h-2 bg-primary rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          ></div>
        </div>
      </div>
    );
  }

  const handleCollapseChat = () => {
    if (chatPanelRef.current) {
      chatPanelRef.current.collapse();
      setIsChatCollapsed(true);
    }
  };

  const handleExpandChat = () => {
    if (chatPanelRef.current) {
      chatPanelRef.current.expand();
      setIsChatCollapsed(false);
    }
  };

  const handleToggleChat = () => {
    if (isChatCollapsed) {
      handleExpandChat();
    } else {
      handleCollapseChat();
    }
  };

  return (
    <div className="h-screen w-screen bg-sidebar overflow-hidden flex flex-col">
      {/* Unified Navigation Bar */}
      <ProjectNav
        projectName={project?.name}
        onProjectNameChange={updateProjectName}
        sandboxId={streamState.sandboxId}
        isChatCollapsed={isChatCollapsed}
        onToggleChat={handleToggleChat}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        chatPanelSize={chatPanelSize}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden px-2 pb-2">
        <ResizablePanelGroup
          direction="horizontal"
          className="rounded-b-2xl overflow-hidden"
        >
          <ResizablePanel
            ref={chatPanelRef}
            defaultSize={25}
            minSize={18}
            maxSize={40}
            collapsible
            collapsedSize={0}
            onCollapse={() => setIsChatCollapsed(true)}
            onExpand={() => setIsChatCollapsed(false)}
            onResize={(size) => setChatPanelSize(size)}
          >
            <ChatBar
              streamState={streamState}
              initialPrompt={initialPrompt}
              initialMessages={initialMessages}
              initialTheme={initialTheme}
            />
          </ResizablePanel>

          <ResizableHandle className="bg-transparent" />

          <ResizablePanel defaultSize={75} minSize={50}>
            <CodeEditor streamState={streamState} activeTab={activeTab} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
