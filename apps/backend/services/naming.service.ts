import { createLLMWithModel } from "@appwit/agent";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { prisma } from "@/lib/prisma";

const NAME_GENERATION_PROMPT = `You are a project naming assistant. Generate a short, creative, and descriptive name for a coding project based on the user's prompt.

Rules:
- Keep it under 30 characters
- Use Title Case (capitalize first letter of each word)
- Make it descriptive but concise
- No special characters, just letters and spaces
- Should reflect the main purpose/feature of the app

Respond with ONLY the project name, nothing else. No quotes, no explanation.`;

export async function generateProjectName(prompt: string): Promise<string | null> {
  try {
    const llm = createLLMWithModel("gpt-4o-mini", { maxTokens: 50, temperature: 0.7 });
    
    const response = await llm.invoke([
      new SystemMessage(NAME_GENERATION_PROMPT),
      new HumanMessage(`User's project request: "${prompt}"\n\nGenerate a project name:`),
    ]);

    // Handle different content types properly
    let rawName: string;
    if (typeof response.content === 'string') {
      rawName = response.content;
    } else if (Array.isArray(response.content)) {
      // Handle content blocks array
      rawName = response.content
        .map((block) => {
          if (typeof block === 'string') return block;
          if (block && typeof block === 'object' && 'text' in block) return block.text;
          return '';
        })
        .join('')
        .trim();
    } else {
      console.error("[NAMING] Unexpected content type:", typeof response.content);
      return null;
    }

    // Validate and clean the name
    const cleanName = rawName
      .replace(/["'`]/g, '') // Remove quotes
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .slice(0, 30);

    if (cleanName.length < 2) {
      console.log("[NAMING] Generated name too short, skipping");
      return null;
    }

    console.log(`[NAMING] Generated project name: "${cleanName}" from prompt`);
    return cleanName;
  } catch (error) {
    console.error("[NAMING] Error generating project name:", error);
    return null;
  }
}

export async function updateProjectName(
  projectId: string,
  name: string
): Promise<void> {
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { name },
    });
    console.log(`[NAMING] Updated project ${projectId} name to: "${name}"`);
  } catch (error) {
    console.error("[NAMING] Error updating project name:", error);
  }
}
