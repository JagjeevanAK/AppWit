import { readFileSync } from 'fs';
import { join } from 'path';

export interface ThemeInfo {
    name: string;
    file: string;
    description: string;
    style: string;  // light, dark, or both
    bestFor: string[];  // use cases
}

export const themes: Record<string, ThemeInfo> = {
    "caffeine": {
        name: "Caffeine",
        file: "theme-1.css",
        description: "Warm coffee-inspired theme with brown/amber primary colors. Light mode has cream background, dark mode features rich espresso tones with golden accents.",
        style: "both",
        bestFor: ["coffee shops", "food apps", "cozy blogs", "productivity apps", "notes apps"]
    },
    "claymorphism": {
        name: "Claymorphism",
        file: "theme-2.css",
        description: "Soft, clay-like 3D aesthetic with purple primary and large rounded corners (1.25rem). Features soft shadows and Plus Jakarta Sans font for a playful, modern feel.",
        style: "both",
        bestFor: ["creative portfolios", "design tools", "kids apps", "playful websites", "3D-style UIs"]
    },
    "darkmatter": {
        name: "Dark Matter",
        file: "theme-3.css",
        description: "Developer-focused theme with monospace fonts (Geist Mono, JetBrains Mono). Orange/amber primary with teal secondary. Minimal shadows. Perfect for code-heavy interfaces.",
        style: "both",
        bestFor: ["developer tools", "code editors", "technical dashboards", "CLI apps", "documentation sites"]
    },
    "graphite": {
        name: "Graphite",
        file: "theme-4.css",
        description: "Minimalist grayscale theme with sharp edges (0.35rem radius). Uses Montserrat font. Clean, professional look with no color distractions. Hard shadows for industrial feel.",
        style: "both",
        bestFor: ["business apps", "enterprise software", "admin panels", "professional portfolios", "minimalist sites"]
    },
    "mocha-mousse": {
        name: "Mocha Mousse",
        file: "theme-5.css",
        description: "Pantone 2025 inspired warm cocoa theme. DM Sans font with earthy brown tones. Cream background with mocha accents. Cozy and inviting aesthetic.",
        style: "both",
        bestFor: ["lifestyle blogs", "recipe apps", "wellness apps", "boutique shops", "warm branding"]
    },
    "elegant-luxury": {
        name: "Elegant Luxury",
        file: "theme-6.css",
        description: "Premium feel with deep burgundy/wine primary colors. Poppins + Libre Baskerville fonts. Gold accents. Soft glowing shadows. High-end, sophisticated aesthetic.",
        style: "both",
        bestFor: ["luxury brands", "jewelry stores", "high-end restaurants", "fashion sites", "premium services"]
    },
    "sage-garden": {
        name: "Sage Garden",
        file: "theme-7.css",
        description: "Nature-inspired with sage green primary. Antic font for organic feel. Soft, subtle shadows. Calming, botanical aesthetic with cream undertones.",
        style: "both",
        bestFor: ["eco brands", "plant shops", "wellness apps", "sustainable products", "organic themes"]
    },
    "twitter": {
        name: "Twitter/X Blue",
        file: "theme-8.css",
        description: "Twitter-inspired bright blue primary. Open Sans font with large rounded corners (1.3rem). Clean white/black contrast. Social media aesthetic.",
        style: "both",
        bestFor: ["social apps", "communication platforms", "news feeds", "messaging apps", "media platforms"]
    },
    "vercel": {
        name: "Vercel",
        file: "theme-9.css",
        description: "Vercel's iconic black & white theme. Pure monochrome with Geist font. Strong shadows. Ultra-minimal, developer-focused. High contrast, no-frills design.",
        style: "both",
        bestFor: ["developer platforms", "SaaS products", "tech startups", "deployment tools", "modern web apps"]
    },
    "amethyst-haze": {
        name: "Amethyst Haze",
        file: "theme-10.css",
        description: "Soft purple/lavender theme with pink accents. Geist + Lora + Fira Code fonts. Dreamy, mystical aesthetic with gentle rose undertones.",
        style: "both",
        bestFor: ["creative apps", "music platforms", "art portfolios", "beauty products", "fantasy themes"]
    }
};

export function getThemeList(): ThemeInfo[] {
    return Object.values(themes);
}

export function getThemeInfo(themeName: string): ThemeInfo | null {
    const normalizedName = themeName.toLowerCase().replace(/\s+/g, '-');
    return themes[normalizedName] || null;
}

export function getThemeCSS(themeName: string): string | null {
    const normalizedName = themeName.toLowerCase().replace(/\s+/g, '-');
    const theme = themes[normalizedName];

    if (!theme) {
        return null;
    }

    try {
        const themePath = join(__dirname, theme.file);
        return readFileSync(themePath, 'utf-8');
    } catch (error) {
        console.error(`Error reading theme file: ${themeName}`, error);
        return null;
    }
}

export function getThemeNames(): string[] {
    return Object.keys(themes);
}

export function findThemesForUseCase(useCase: string): ThemeInfo[] {
    const searchTerm = useCase.toLowerCase();
    return Object.values(themes).filter(theme =>
        theme.bestFor.some(use => use.toLowerCase().includes(searchTerm)) ||
        theme.description.toLowerCase().includes(searchTerm)
    );
}
