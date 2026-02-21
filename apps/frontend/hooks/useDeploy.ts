"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { BackendUrl } from "@/config";

interface DeployState {
  isDeploying: boolean;
  deploymentUrl: string | null;
  lastDeployedAt: string | null;
  error: string | null;
}

export function useDeploy(projectId: string) {
  const [state, setState] = useState<DeployState>({
    isDeploying: false,
    deploymentUrl: null,
    lastDeployedAt: null,
    error: null,
  });

  const isDeployingRef = useRef(false);

  const deploy = useCallback(async () => {
    if (!projectId || isDeployingRef.current) return;

    isDeployingRef.current = true;
    setState((prev) => ({ ...prev, isDeploying: true, error: null }));

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        isDeployingRef.current = false;
        setState((prev) => ({
          ...prev,
          isDeploying: false,
          error: "Not authenticated",
        }));
        return;
      }

      const response = await fetch(`${BackendUrl}/deploy/${projectId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to deploy");
      }

      const data = await response.json();
      isDeployingRef.current = false;
      setState({
        isDeploying: false,
        deploymentUrl: data.deploymentUrl,
        lastDeployedAt: new Date().toISOString(),
        error: null,
      });

      return data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to deploy";
      isDeployingRef.current = false;
      setState((prev) => ({
        ...prev,
        isDeploying: false,
        error: errorMessage,
      }));
      throw err;
    }
  }, [projectId]);

  const fetchStatus = useCallback(async () => {
    if (!projectId) return;

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) return;

      const response = await fetch(
        `${BackendUrl}/deploy/${projectId}/status`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setState((prev) => ({
          ...prev,
          deploymentUrl: data.url,
          lastDeployedAt: data.lastDeployedAt,
        }));
      }
    } catch (err) {
      console.error("Error fetching deployment status:", err);
    }
  }, [projectId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    ...state,
    deploy,
    fetchStatus,
  };
}
