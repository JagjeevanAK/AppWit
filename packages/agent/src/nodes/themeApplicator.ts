// Theme applicator node - applies CSS theme to globals.css

import type { Sandbox } from "e2b";
import { getThemeCSS, getThemeNames } from "../data/themes";
import { log, type GraphStateType, type StreamConfig } from "./types";

// Default theme to use when none specified
const DEFAULT_THEME = "vercel";

// Get list of valid theme names for validation
const VALID_THEMES = new Set(getThemeNames());

/**
 * Validates and normalizes a theme name
 * Returns the normalized theme name or null if invalid
 */
function validateThemeName(
  themeName: string | null | undefined
): string | null {
  if (!themeName || typeof themeName !== "string") {
    return null;
  }

  const normalized = themeName.toLowerCase().trim();
  const withoutSpaces = normalized.replace(/\s+/g, "");
  const withHyphens = normalized.replace(/\s+/g, "-");
  const compact = normalized.replace(/[\s-]+/g, "");

  if (VALID_THEMES.has(normalized)) {
    return normalized;
  }
  if (VALID_THEMES.has(withoutSpaces)) {
    return withoutSpaces;
  }
  if (VALID_THEMES.has(withHyphens)) {
    return withHyphens;
  }
  if (VALID_THEMES.has(compact)) {
    return compact;
  }

  log.theme(
    `Invalid theme name "${themeName}", available themes: ${[...VALID_THEMES].join(", ")}`
  );
  return null;
}

export function createThemeApplicatorNode(sandbox: Sandbox) {
  return async (
    state: GraphStateType,
    config?: StreamConfig
  ): Promise<Partial<GraphStateType>> => {
    // Validate theme name
    const validatedTheme = validateThemeName(state.theme);
    const themeToApply = validatedTheme || DEFAULT_THEME;

    if (!validatedTheme) {
      log.theme(`No valid theme specified, using default: ${DEFAULT_THEME}`);
    }

    log.theme(`Applying theme: ${themeToApply}`);
    config?.configurable?.streamCallback?.({
      type: "executing",
      message: `Applying theme: ${themeToApply}`,
    });

    try {
      const themeCSS = getThemeCSS(themeToApply);

      if (!themeCSS) {
        log.theme(`Theme "${themeToApply}" CSS not found, skipping`);
        return {};
      }

      await sandbox.files.write("/home/user/app/globals.css", themeCSS);
      log.theme(`Theme "${themeToApply}" applied to globals.css`);
      config?.configurable?.streamCallback?.({
        type: "completed",
        message: `Theme "${themeToApply}" applied`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.theme(`Error applying theme: ${errorMessage}`);
      config?.configurable?.streamCallback?.({
        type: "error",
        message: `Failed to apply theme`,
      });
    }

    return {};
  };
}
