"use client";

import InputBox from "@/components/inputbox";
import LiquidEther from "@/components/LiquidEther";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();

  const handlePromptSubmit = (prompt: string) => {
    if (!user) {
      // Store prompt for after authentication
      localStorage.setItem("pendingPrompt", prompt);
      router.push("/signup");
    } else {
      // Store prompt and navigate to project creation
      localStorage.setItem("pendingPrompt", prompt);
      router.push("/project");
    }
  };

  return (
    <div className="relative flex items-center min-h-screen justify-center flex-col text-white overflow-hidden py-12">
      <div className="absolute inset-0 -z-10">
        <LiquidEther
          colors={["#5227FF", "#FF9FFC", "#B19EEF"]}
          mouseForce={20}
          cursorSize={100}
          resolution={0.5}
          autoDemo={true}
          autoSpeed={0.5}
          autoIntensity={2.2}
        />
      </div>
      <div className="z-10 w-full max-w-2xl px-4 flex flex-col items-center gap-8">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            What do you want to build?
          </h1>
          <p className="text-lg text-muted-foreground">
            Prompt, run, edit, and deploy full-stack web apps.
          </p>
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
