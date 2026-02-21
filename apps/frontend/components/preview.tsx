"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@/components/ui/loader";

interface PreviewProps {
    preview_url: string | null;
    isStreaming?: boolean;
}

const MAX_IFRAME_RETRIES = 15;
const INITIAL_RETRY_DELAY_MS = 3000;
const MAX_RETRY_DELAY_MS = 10000;

export default function Preview({ preview_url, isStreaming = false }: PreviewProps) {
    const lastValidUrlRef = useRef<string | null>(null);
    const [isIframeLoading, setIsIframeLoading] = useState(true);
    const [iframeError, setIframeError] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [retryCount, setRetryCount] = useState(0);
    const wasStreamingRef = useRef(false);

    useEffect(() => {
        if (preview_url) {
            lastValidUrlRef.current = preview_url;
            setIsIframeLoading(true);
            setIframeError(false);
            setRetryCount(0);
        }
    }, [preview_url]);

    // Refresh iframe when code generation completes (streaming ends)
    useEffect(() => {
        if (wasStreamingRef.current && !isStreaming) {
            // Streaming just finished - refresh iframe
            console.log('[Preview] Code generation completed, refreshing iframe');
            setRefreshKey(prev => prev + 1);
            setIsIframeLoading(true);
        }
        wasStreamingRef.current = isStreaming;
    }, [isStreaming]);

    const displayUrl = preview_url || lastValidUrlRef.current;

    useEffect(() => {
        if (!displayUrl || !isIframeLoading) {
            return;
        }

        if (retryCount >= MAX_IFRAME_RETRIES) {
            console.warn("[Preview] Max retry attempts reached, showing error state");
            setIsIframeLoading(false);
            setIframeError(true);
            return;
        }

        const retryDelayMs = Math.min(
            INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount),
            MAX_RETRY_DELAY_MS
        );
        const timeoutId = window.setTimeout(() => {
            console.log(
                `[Preview] Retrying iframe load (attempt ${retryCount + 1}/${MAX_IFRAME_RETRIES})`
            );
            setRefreshKey((prev) => prev + 1);
            setRetryCount((prev) => prev + 1);
        }, retryDelayMs);

        return () => window.clearTimeout(timeoutId);
    }, [displayUrl, isIframeLoading, retryCount]);

    if (!displayUrl) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-background rounded-2xl border border-border">
                <div className="text-center space-y-4">
                    <Loader size="lg" />
                    <div className="space-y-2">
                        <p className="text-foreground text-lg font-medium">
                            {isStreaming ? "Generating code..." : "Waiting for code generation..."}
                        </p>
                        <p className="text-muted-foreground text-sm">
                            The AI is creating your application
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const handleIframeLoad = () => {
        setIsIframeLoading(false);
        setIframeError(false);
        setRetryCount(0);
        console.log('[Preview] Iframe loaded successfully:', displayUrl);
    };

    const handleIframeError = () => {
        setIsIframeLoading(false);
        setIframeError(true);
        console.error('[Preview] Iframe failed to load:', displayUrl);
    };

    const iframeSrc = `${displayUrl}${displayUrl.includes("?") ? "&" : "?"}__appwit_reload=${refreshKey}`;

    return (
        <div className="w-full h-full relative">
            {/* Loading overlay - shown while iframe is loading */}
            {isIframeLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background rounded-2xl border border-border z-10">
                    <div className="text-center space-y-4">
                        <Loader size="lg" />
                        <div className="space-y-2">
                            <p className="text-foreground text-lg font-medium">Loading preview...</p>
                            <p className="text-muted-foreground text-sm">Your application is starting up</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Error overlay */}
            {iframeError && !isIframeLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background rounded-2xl border border-border z-10">
                    <div className="text-center space-y-4">
                        <p className="text-foreground text-lg font-medium">Preview unavailable</p>
                        <p className="text-muted-foreground text-sm">The sandbox may be starting up. Please wait...</p>
                        <button
                            onClick={() => {
                                setIsIframeLoading(true);
                                setIframeError(false);
                                setRetryCount(0);
                                setRefreshKey((prev) => prev + 1);
                            }}
                            className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-foreground rounded-lg transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            )}

            <iframe
                key={iframeSrc}
                src={iframeSrc}
                className="w-full h-full border-0 rounded-2xl"
                title="Application Preview"
                allow="clipboard-read; clipboard-write; camera; microphone; geolocation; fullscreen"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
            />
        </div>
    );
}
