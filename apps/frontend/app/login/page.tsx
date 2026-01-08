import { LoginForm } from "@/components/login-form"
import DotGrid from "@/components/dotGrid"

export default function Page() {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-black overflow-hidden">
      {/* Background DotGrid */}
      <div className="absolute inset-0 z-0">
        <DotGrid
          baseColor="#201e24"
          activeColor="#ece9e4"
          dotSize={8}
          gap={24}
          proximity={120}
        />
      </div>

      <div className="w-full max-w-sm z-10 relative">
        <LoginForm />
      </div>
    </div>
  )
}
