"use client";

import InputBox from "@/components/inputbox";
import DotGrid from "@/components/dotGrid";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();

  const handlePromptSubmit = (prompt: string, theme?: string) => {
    // Store prompt and theme
    localStorage.setItem("pendingPrompt", prompt);
    if (theme) {
      localStorage.setItem("pendingTheme", theme);
    } else {
      localStorage.removeItem("pendingTheme");
    }

    if (!user) {
      router.push("/signup");
    } else {
      router.push("/project");
    }
  };

  return (
    <div className="relative flex items-center min-h-screen justify-center flex-col text-white overflow-hidden py-12 bg-black">
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

      {/* Content */}
      <div className="z-10 w-full max-w-2xl px-4 flex flex-col items-center gap-8 relative">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Let's build something
          </h1>
        </div>

        <div className="w-full">
          <InputBox
            width="100%"
            height="auto"
            maxHeight="200px"
            animatedPlaceholder={true}
            onSendMessage={handlePromptSubmit}
          />
        </div>
      </div>
    </div>
  );
}
