// Summary service - generates human-readable summaries for agent responses

export function generateCodeSummary(
  files: string[],
  commandCount: number,
  action: "created" | "updated"
): string {
  if (files.length === 0) {
    return action === "created"
      ? "Your project is ready to go! Feel free to ask me to add features or make changes."
      : "I looked into your request, but everything seems good as is. Let me know if you'd like something specific changed!";
  }

  // Analyze the files to understand what was done
  const fileNames = files.map((f) => f.split("/").pop() || f);

  // Categorize files
  const components = files.filter(
    (f) => f.includes("/components/") || f.includes("Component")
  );
  const pages = files.filter(
    (f) =>
      f.includes("/app/") || f.includes("/pages/") || f.includes("page.tsx")
  );
  const styles = files.filter(
    (f) => f.endsWith(".css") || f.endsWith(".scss") || f.endsWith(".tailwind")
  );
  const configs = files.filter(
    (f) =>
      f.includes("config") ||
      f.endsWith(".json") ||
      f.endsWith(".config.ts") ||
      f.endsWith(".config.js")
  );
  const utils = files.filter(
    (f) => f.includes("/lib/") || f.includes("/utils/") || f.includes("/hooks/")
  );
  const api = files.filter(
    (f) =>
      f.includes("/api/") || f.includes("route.ts") || f.includes("route.js")
  );

  if (action === "created") {
    return generateCreationSummary(
      files,
      fileNames,
      components,
      pages,
      styles,
      configs,
      utils,
      api,
      commandCount
    );
  } else {
    return generateUpdateSummary(
      files,
      fileNames,
      components,
      pages,
      styles,
      configs,
      utils,
      api,
      commandCount
    );
  }
}

function generateCreationSummary(
  files: string[],
  fileNames: string[],
  components: string[],
  pages: string[],
  styles: string[],
  configs: string[],
  utils: string[],
  api: string[],
  commandCount: number
): string {
  const parts: string[] = [];

  // Main intro
  parts.push("All done!");

  // Describe what was built
  const highlights: string[] = [];

  if (pages.length > 0) {
    const pageCount = pages.length;
    highlights.push(pageCount === 1 ? "the main page" : `${pageCount} pages`);
  }

  if (components.length > 0) {
    const componentCount = components.length;
    if (componentCount <= 3) {
      const names = components
        .map((c) =>
          c
            .split("/")
            .pop()
            ?.replace(/\.(tsx|jsx|ts|js)$/, "")
        )
        .filter(Boolean);
      highlights.push(
        names.join(", ") + (componentCount > 1 ? " components" : " component")
      );
    } else {
      highlights.push(`${componentCount} components`);
    }
  }

  if (api.length > 0) {
    highlights.push(
      api.length === 1 ? "an API endpoint" : `${api.length} API routes`
    );
  }

  if (utils.length > 0) {
    highlights.push("utility functions");
  }

  if (styles.length > 0 && highlights.length < 3) {
    highlights.push("styling");
  }

  // Build the description
  if (highlights.length > 0) {
    parts.push(`I've set up ${formatList(highlights)} for you.`);
  } else {
    parts.push(`I've created ${files.length} files to get you started.`);
  }

  // Mention dependencies if installed
  if (commandCount > 0) {
    parts.push("Dependencies are installed and ready.");
  }

  // Friendly closing
  parts.push(
    "Take a look at the preview and let me know what you'd like to tweak!"
  );

  return parts.join(" ");
}

function generateUpdateSummary(
  files: string[],
  fileNames: string[],
  components: string[],
  pages: string[],
  styles: string[],
  configs: string[],
  utils: string[],
  api: string[],
  commandCount: number
): string {
  const parts: string[] = [];

  // Casual intro variations based on scope
  if (files.length === 1) {
    parts.push("Done!");
  } else if (files.length <= 3) {
    parts.push("All updated!");
  } else {
    parts.push("Changes are in!");
  }

  // Describe what was changed
  if (files.length === 1) {
    const fileName = fileNames[0] || "the file";
    const cleanName = fileName.replace(/\.(tsx|jsx|ts|js|css|scss)$/, "");

    if (styles.length > 0) {
      parts.push(`I've updated the styling in ${fileName}.`);
    } else if (components.length > 0) {
      parts.push(`I've made the changes to the ${cleanName} component.`);
    } else if (pages.length > 0) {
      parts.push(`I've updated the ${cleanName} page.`);
    } else if (api.length > 0) {
      parts.push(`I've modified the API route.`);
    } else {
      parts.push(`I've updated ${fileName}.`);
    }
  } else if (files.length <= 3) {
    const cleanNames = fileNames.map((f) =>
      f.replace(/\.(tsx|jsx|ts|js|css|scss)$/, "")
    );
    parts.push(`I've updated ${formatList(cleanNames)}.`);
  } else {
    // Multiple files - summarize by category
    const changes: string[] = [];

    if (components.length > 0) {
      changes.push(
        components.length === 1
          ? "1 component"
          : `${components.length} components`
      );
    }
    if (pages.length > 0) {
      changes.push(pages.length === 1 ? "1 page" : `${pages.length} pages`);
    }
    if (styles.length > 0) {
      changes.push("styling");
    }
    if (api.length > 0) {
      changes.push(
        api.length === 1 ? "an API route" : `${api.length} API routes`
      );
    }
    if (utils.length > 0) {
      changes.push("utilities");
    }

    if (changes.length > 0) {
      parts.push(
        `I've updated ${formatList(changes)} (${files.length} files total).`
      );
    } else {
      parts.push(`I've updated ${files.length} files.`);
    }
  }

  // Mention new dependencies if any
  if (commandCount > 0) {
    parts.push("Also installed some new dependencies.");
  }

  // Friendly closing
  const closings = [
    "Check it out and let me know if you need anything else!",
    "The preview should reflect the changes. What's next?",
    "Let me know if this is what you had in mind!",
    "Anything else you'd like me to adjust?",
  ];

  // Pick a closing based on file count for variety
  parts.push(closings[files.length % closings.length]!);

  return parts.join(" ");
}

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
