import { useEffect, useRef, useCallback } from 'react';
import { BackendUrl } from '@/config';

const HEARTBEAT_INTERVAL = 60000;

/**
 * Hook to keep sandbox alive via periodic heartbeats.
 * @param sandboxId - The sandbox ID to keep alive
 * @param onSandboxDead - Optional callback when sandbox is detected as dead (404 response)
 */
export function useSandboxHeartbeat(
    sandboxId: string | null,
    onSandboxDead?: () => void
) {
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const onSandboxDeadRef = useRef(onSandboxDead);

    // Keep callback ref updated
    useEffect(() => {
        onSandboxDeadRef.current = onSandboxDead;
    }, [onSandboxDead]);

    useEffect(() => {
        if (!sandboxId) {
            return;
        }

        const sendHeartbeat = async () => {
            try {
                const token = localStorage.getItem('auth_token');
                const response = await fetch(`${BackendUrl}/prompt/refresh/${sandboxId}`, {
                    method: 'POST',
                    headers: token ? {
                        'Authorization': `Bearer ${token}`
                    } : {}
                });

                // If sandbox not found (killed), notify parent
                if (response.status === 404) {
                    console.log('[HEARTBEAT] Sandbox is dead (404), triggering callback');
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                    }
                    onSandboxDeadRef.current?.();
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

