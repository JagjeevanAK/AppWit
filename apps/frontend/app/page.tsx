"use client";

import InputBox from "@/components/inputbox";
import Threads from "@/components/Threads";
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
      {/* Background Threads */}
      <div className="absolute inset-0 z-0">
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <Threads
            color={[1, 1, 1]}
            amplitude={1.7}
            distance={0}
            enableMouseInteraction
          />
        </div>
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
