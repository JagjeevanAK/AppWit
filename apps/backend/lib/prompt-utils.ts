import { themes } from "@appwit/agent";

const VALID_THEMES = new Set(Object.keys(themes));

export function buildPromptWithTheme(prompt: string, theme?: string): string {
  if (!theme || typeof theme !== "string" || !theme.trim()) {
    return prompt;
  }

  const normalized = theme.trim().toLowerCase();
  if (!VALID_THEMES.has(normalized)) {
    console.warn(`[PROMPT] Unknown theme "${theme}", ignoring to prevent injection`);
    return prompt;
  }

  return `${prompt}\n\nIMPORTANT: The user has explicitly selected the '${normalized}' theme. Please apply this theme.`;
}