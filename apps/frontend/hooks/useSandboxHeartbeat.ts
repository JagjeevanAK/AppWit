import { useEffect, useRef, useCallback } from 'react';
import { BackendUrl } from '@/config';

const HEARTBEAT_INTERVAL = 60000;

interface UseSandboxHeartbeatOptions {
    onSandboxDead?: () => void;
}

export function useSandboxHeartbeat(
    sandboxId: string | null,
    options: UseSandboxHeartbeatOptions = {}
) {
    const { onSandboxDead } = options;
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const isResurrectingRef = useRef(false);
    const onSandboxDeadRef = useRef(onSandboxDead);

    // Keep callback ref updated
    useEffect(() => {
        onSandboxDeadRef.current = onSandboxDead;
    }, [onSandboxDead]);

    // Reset resurrection flag when sandboxId changes (new sandbox available)
    useEffect(() => {
        if (sandboxId) {
            isResurrectingRef.current = false;
        }
    }, [sandboxId]);

    useEffect(() => {
        if (!sandboxId) {
            return;
        }

        const sendHeartbeat = async () => {
            // Skip if we're already resurrecting
            if (isResurrectingRef.current) {
                return;
            }

            try {
                const token = localStorage.getItem('auth_token');
                const response = await fetch(`${BackendUrl}/prompt/refresh/${sandboxId}`, {
                    method: 'POST',
                    headers: token ? {
                        'Authorization': `Bearer ${token}`
                    } : {}
                });

                // Sandbox was killed - trigger resurrection
                if (response.status === 404) {
                    console.log('[HEARTBEAT] Sandbox not found (404), triggering resurrection');

                    // Prevent multiple resurrection attempts
                    if (!isResurrectingRef.current) {
                        isResurrectingRef.current = true;

                        // Clear the heartbeat interval
                        if (intervalRef.current) {
                            clearInterval(intervalRef.current);
                            intervalRef.current = null;
                        }

                        // Trigger resurrection callback
                        onSandboxDeadRef.current?.();
                    }
                }
            } catch (error) {
                console.error('Failed to send sandbox heartbeat:', error);
            }
        };

        sendHeartbeat();

        intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [sandboxId]);
}
