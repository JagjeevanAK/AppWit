import React from "react";

// File extension to icon mapping
const fileExtensionMap: Record<string, string> = {
  // TypeScript/JavaScript
  ts: "file_type_typescript",
  tsx: "file_type_reactts",
  js: "file_type_js",
  jsx: "file_type_reactjs",
  mjs: "file_type_js",
  cjs: "file_type_js",

  // Web
  html: "file_type_html",
  htm: "file_type_html",
  css: "file_type_css",
  scss: "file_type_scss",
  sass: "file_type_sass",
  less: "file_type_less",
  svg: "file_type_svg",

  // Data formats
  json: "file_type_json",
  yaml: "file_type_yaml",
  yml: "file_type_yaml",
  xml: "file_type_xml",
  toml: "file_type_toml",

  // Documentation
  md: "file_type_markdown",
  mdx: "file_type_markdown",
  txt: "file_type_text",
  pdf: "file_type_pdf",

  // Programming languages
  py: "file_type_python",
  rs: "file_type_rust",
  go: "file_type_go",
  java: "file_type_java",
  c: "file_type_c",
  cpp: "file_type_cpp",
  cc: "file_type_cpp",
  cxx: "file_type_cpp",
  cs: "file_type_csharp",
  php: "file_type_php",
  rb: "file_type_ruby",
  swift: "file_type_swift",
  kt: "file_type_kotlin",
  scala: "file_type_scala",

  // Shell/Scripts
  sh: "file_type_shell",
  bash: "file_type_shell",
  zsh: "file_type_shell",
  fish: "file_type_shell",
  ps1: "file_type_powershell",

  // Config/Build
  dockerfile: "file_type_docker",
  prisma: "file_type_prisma",
  graphql: "file_type_graphql",
  gql: "file_type_graphql",
  sql: "file_type_sql",

  // Images
  png: "file_type_image",
  jpg: "file_type_image",
  jpeg: "file_type_image",
  gif: "file_type_image",
  webp: "file_type_image",
  ico: "file_type_image",
  bmp: "file_type_image",

  // Fonts
  ttf: "file_type_font",
  otf: "file_type_font",
  woff: "file_type_font",
  woff2: "file_type_font",
  eot: "file_type_font",

  // Archives
  zip: "file_type_zip",
  tar: "file_type_zip",
  gz: "file_type_zip",
  rar: "file_type_zip",
  "7z": "file_type_zip",

  // Media
  mp3: "file_type_audio",
  wav: "file_type_audio",
  ogg: "file_type_audio",
  flac: "file_type_audio",
  mp4: "file_type_video",
  webm: "file_type_video",
  avi: "file_type_video",
  mov: "file_type_video",

  // Vue/Angular/Svelte
  vue: "file_type_vue",
  svelte: "file_type_svelte",
};

// Exact filename to icon mapping (case-insensitive)
const filenameMap: Record<string, string> = {
  // Package managers
  "package.json": "file_type_npm",
  "package-lock.json": "file_type_npm",
  "yarn.lock": "file_type_yarn",
  "pnpm-lock.yaml": "file_type_pnpm",
  "bun.lockb": "file_type_bun",
  "bun.lock": "file_type_bun",

  // TypeScript configs
  "tsconfig.json": "file_type_tsconfig",
  "tsconfig.base.json": "file_type_tsconfig",
  "tsconfig.node.json": "file_type_tsconfig",
  "jsconfig.json": "file_type_jsconfig",

  // Build tools
  "vite.config.ts": "file_type_vite",
  "vite.config.js": "file_type_vite",
  "next.config.js": "file_type_next",
  "next.config.ts": "file_type_next",
  "next.config.mjs": "file_type_next",
  "nuxt.config.ts": "file_type_nuxt",
  "nuxt.config.js": "file_type_nuxt",
  "webpack.config.js": "file_type_webpack",
  "webpack.config.ts": "file_type_webpack",
  "rollup.config.js": "file_type_rollup",
  "rollup.config.ts": "file_type_rollup",
  "babel.config.js": "file_type_babel",
  "babel.config.json": "file_type_babel",
  ".babelrc": "file_type_babel",

  // Linting/Formatting
  ".eslintrc": "file_type_eslint",
  ".eslintrc.js": "file_type_eslint",
  ".eslintrc.cjs": "file_type_eslint",
  ".eslintrc.json": "file_type_eslint",
  "eslint.config.js": "file_type_eslint",
  "eslint.config.mjs": "file_type_eslint",
  ".prettierrc": "file_type_prettier",
  ".prettierrc.js": "file_type_prettier",
  ".prettierrc.json": "file_type_prettier",
  "prettier.config.js": "file_type_prettier",
  ".editorconfig": "file_type_editorconfig",

  // Tailwind
  "tailwind.config.js": "file_type_tailwind",
  "tailwind.config.ts": "file_type_tailwind",
  "tailwind.config.cjs": "file_type_tailwind",

  // Testing
  "jest.config.js": "file_type_jest",
  "jest.config.ts": "file_type_jest",
  "vitest.config.js": "file_type_vitest",
  "vitest.config.ts": "file_type_vitest",

  // Git
  ".gitignore": "file_type_gitignore",
  ".gitattributes": "file_type_git",
  ".gitmodules": "file_type_git",

  // Environment
  ".env": "file_type_env",
  ".env.local": "file_type_env",
  ".env.development": "file_type_env",
  ".env.production": "file_type_env",
  ".env.example": "file_type_env",

  // Docker
  dockerfile: "file_type_docker",
  "docker-compose.yml": "file_type_docker",
  "docker-compose.yaml": "file_type_docker",
  ".dockerignore": "file_type_docker",

  // Database
  "schema.prisma": "file_type_prisma",

  // Documentation
  "readme.md": "file_type_readme",
  readme: "file_type_readme",
  "changelog.md": "file_type_changelog",
  changelog: "file_type_changelog",
  license: "file_type_license",
  "license.md": "file_type_license",
  "license.txt": "file_type_license",

  // Lock files
  "composer.lock": "file_type_lock",
  "gemfile.lock": "file_type_lock",
  "cargo.lock": "file_type_lock",
  "poetry.lock": "file_type_lock",

  // Node
  ".nvmrc": "file_type_node",
  ".node-version": "file_type_node",

  // Storybook
  ".storybook": "file_type_storybook",
};

// Folder name to icon mapping
const folderMap: Record<string, { closed: string; open: string }> = {
  src: { closed: "folder_type_src", open: "folder_type_src_opened" },
  source: { closed: "folder_type_src", open: "folder_type_src_opened" },
  components: {
    closed: "folder_type_component",
    open: "folder_type_component_opened",
  },
  component: {
    closed: "folder_type_component",
    open: "folder_type_component_opened",
  },
  api: { closed: "folder_type_api", open: "folder_type_api_opened" },
  apis: { closed: "folder_type_api", open: "folder_type_api_opened" },
  config: { closed: "folder_type_config", open: "folder_type_config_opened" },
  configs: { closed: "folder_type_config", open: "folder_type_config_opened" },
  configuration: {
    closed: "folder_type_config",
    open: "folder_type_config_opened",
  },
  public: { closed: "folder_type_public", open: "folder_type_public_opened" },
  static: { closed: "folder_type_public", open: "folder_type_public_opened" },
  lib: { closed: "folder_type_lib", open: "folder_type_lib_opened" },
  libs: { closed: "folder_type_lib", open: "folder_type_lib_opened" },
  hooks: { closed: "folder_type_src", open: "folder_type_src_opened" },
  utils: { closed: "folder_type_src", open: "folder_type_src_opened" },
  utilities: { closed: "folder_type_src", open: "folder_type_src_opened" },
  helpers: { closed: "folder_type_src", open: "folder_type_src_opened" },
  test: { closed: "folder_type_test", open: "folder_type_test_opened" },
  tests: { closed: "folder_type_test", open: "folder_type_test_opened" },
  __tests__: { closed: "folder_type_test", open: "folder_type_test_opened" },
  spec: { closed: "folder_type_test", open: "folder_type_test_opened" },
  specs: { closed: "folder_type_test", open: "folder_type_test_opened" },
  images: { closed: "folder_type_images", open: "folder_type_images_opened" },
  img: { closed: "folder_type_images", open: "folder_type_images_opened" },
  assets: { closed: "folder_type_images", open: "folder_type_images_opened" },
  styles: { closed: "folder_type_src", open: "folder_type_src_opened" },
  css: { closed: "folder_type_src", open: "folder_type_src_opened" },
  node_modules: { closed: "folder_type_node", open: "folder_type_node_opened" },
  ".git": { closed: "folder_type_git", open: "folder_type_git_opened" },
  dist: { closed: "folder_type_dist", open: "folder_type_dist_opened" },
  build: { closed: "folder_type_dist", open: "folder_type_dist_opened" },
  out: { closed: "folder_type_dist", open: "folder_type_dist_opened" },
  ".next": { closed: "folder_type_dist", open: "folder_type_dist_opened" },
  docs: { closed: "folder_type_docs", open: "folder_type_docs_opened" },
  documentation: {
    closed: "folder_type_docs",
    open: "folder_type_docs_opened",
  },
  app: { closed: "folder_type_app", open: "folder_type_app_opened" },
  pages: { closed: "folder_type_app", open: "folder_type_app_opened" },
  middleware: {
    closed: "folder_type_middleware",
    open: "folder_type_middleware_opened",
  },
  middlewares: {
    closed: "folder_type_middleware",
    open: "folder_type_middleware_opened",
  },
  services: {
    closed: "folder_type_services",
    open: "folder_type_services_opened",
  },
  service: {
    closed: "folder_type_services",
    open: "folder_type_services_opened",
  },
  types: { closed: "folder_type_src", open: "folder_type_src_opened" },
  typings: { closed: "folder_type_src", open: "folder_type_src_opened" },
  context: { closed: "folder_type_src", open: "folder_type_src_opened" },
  contexts: { closed: "folder_type_src", open: "folder_type_src_opened" },
  store: { closed: "folder_type_src", open: "folder_type_src_opened" },
  stores: { closed: "folder_type_src", open: "folder_type_src_opened" },
  state: { closed: "folder_type_src", open: "folder_type_src_opened" },
  prisma: { closed: "folder_type_prisma", open: "folder_type_prisma_opened" },
  database: { closed: "folder_type_prisma", open: "folder_type_prisma_opened" },
  db: { closed: "folder_type_prisma", open: "folder_type_prisma_opened" },
  ui: { closed: "folder_type_component", open: "folder_type_component_opened" },
};

/**
 * Get the icon name for a file based on its filename
 */
export function getFileIconName(filename: string): string {
  const lowerName = filename.toLowerCase();

  // Check exact filename match first
  if (filenameMap[lowerName]) {
    return filenameMap[lowerName];
  }

  // Check for test files
  if (
    lowerName.includes(".test.") ||
    lowerName.includes(".spec.") ||
    lowerName.includes("_test.") ||
    lowerName.includes("_spec.")
  ) {
    if (lowerName.endsWith(".ts") || lowerName.endsWith(".tsx")) {
      return "file_type_testts";
    }
    if (lowerName.endsWith(".js") || lowerName.endsWith(".jsx")) {
      return "file_type_testjs";
    }
    return "file_type_test";
  }

  // Get extension
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (fileExtensionMap[ext]) {
    return fileExtensionMap[ext];
  }

  return "default_file";
}

/**
 * Get the icon name for a folder based on its name
 */
export function getFolderIconName(folderName: string, isOpen: boolean): string {
  const lowerName = folderName.toLowerCase();

  if (folderMap[lowerName]) {
    return isOpen ? folderMap[lowerName].open : folderMap[lowerName].closed;
  }

  return isOpen ? "default_folder_opened" : "default_folder";
}

interface FileIconProps {
  filename: string;
  isFolder?: boolean;
  isOpen?: boolean;
  className?: string;
  size?: number;
}

/**
 * FileIcon component - renders the appropriate VS Code-style icon
 */
export function FileIcon({
  filename,
  isFolder = false,
  isOpen = false,
  className = "",
  size = 16,
}: FileIconProps) {
  const iconName = isFolder
    ? getFolderIconName(filename, isOpen)
    : getFileIconName(filename);

  return (
    <img
      src={`/file-icons/${iconName}.svg`}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size }}
      onError={(e) => {
        // Fallback to default icon if specific icon doesn't exist
        const target = e.target as HTMLImageElement;
        if (isFolder) {
          target.src = isOpen
            ? "/file-icons/default_folder_opened.svg"
            : "/file-icons/default_folder.svg";
        } else {
          target.src = "/file-icons/default_file.svg";
        }
      }}
    />
  );
}

export default FileIcon;
