"use client"

import { Suspense } from "react"
import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Loader } from "@/components/ui/loader"

function AuthCallbackContent() {
    const searchParams = useSearchParams()

    useEffect(() => {
        const token = searchParams.get("token")
        const userParam = searchParams.get("user")
        const error = searchParams.get("error")

        if (error) {
            window.location.href = `/login?error=${error}`
            return
        }

        if (token && userParam) {
            try {
                const user = JSON.parse(userParam)
                localStorage.setItem("auth_token", token)
                localStorage.setItem("user", JSON.stringify(user))

                // Check for pending prompt
                const pendingPrompt = localStorage.getItem("pendingPrompt")
                if (pendingPrompt) {
                    // Use window.location.href for hard navigation to ensure AuthProvider
                    // reads fresh localStorage data on mount
                    window.location.href = "/project"
                } else {
                    window.location.href = "/"
                }
            } catch {
                window.location.href = "/login?error=invalid_response"
            }
        } else {
            window.location.href = "/login"
        }
    }, [searchParams])

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <Loader size="lg" text="Signing in..." />
        </div>
    )
}

export default function AuthCallback() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader size="lg" text="Signing in..." />
            </div>
        }>
            <AuthCallbackContent />
        </Suspense>
    )
}
