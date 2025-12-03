"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export default function AuthCallback() {
    const router = useRouter()
    const searchParams = useSearchParams()

    useEffect(() => {
        const token = searchParams.get("token")
        const userParam = searchParams.get("user")
        const error = searchParams.get("error")

        if (error) {
            router.push(`/login?error=${error}`)
            return
        }

        if (token && userParam) {
            try {
                const user = JSON.parse(userParam)
                localStorage.setItem("token", token)
                localStorage.setItem("user", JSON.stringify(user))
                router.push("/")
            } catch {
                router.push("/login?error=invalid_response")
            }
        } else {
            router.push("/login")
        }
    }, [router, searchParams])

    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="text-white">Signing in...</div>
        </div>
    )
}
