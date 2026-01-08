export interface ThemeInfo {
    id: string;
    name: string;
    description: string;
    colors: string[]; // Hex codes for preview
}

export const themes: ThemeInfo[] = [
    {
        id: "default",
        name: "Default",
        description: "Let the agent decide the best theme for your project.",
        colors: ["#ffffff", "#888888", "#000000"]
    },
    {
        id: "caffeine",
        name: "Caffeine",
        description: "Warm coffee-inspired theme with brown/amber primary colors.",
        colors: ["#D2691E", "#F5DEB3", "#8B4513"]
    },
    {
        id: "claymorphism",
        name: "Claymorphism",
        description: "Soft, clay-like 3D aesthetic with purple primary.",
        colors: ["#E0E5EC", "#A3B1C6", "#9D4EDD"]
    },
    {
        id: "darkmatter",
        name: "Dark Matter",
        description: "Developer-focused theme with orange/amber primary.",
        colors: ["#0F172A", "#F59E0B", "#10B981"]
    },
    {
        id: "graphite",
        name: "Graphite",
        description: "Minimalist grayscale theme with clean, professional look.",
        colors: ["#374151", "#9CA3AF", "#F3F4F6"]
    },
    {
        id: "mocha-mousse",
        name: "Mocha Mousse",
        description: "Warm cocoa theme with earthy brown tones.",
        colors: ["#5D4037", "#D7CCC8", "#8D6E63"]
    },
    {
        id: "elegant-luxury",
        name: "Elegant Luxury",
        description: "Premium feel with deep burgundy/wine primary colors.",
        colors: ["#800020", "#FFD700", "#1A1A1A"]
    },
    {
        id: "sage-garden",
        name: "Sage Garden",
        description: "Nature-inspired with sage green primary.",
        colors: ["#8FBC8F", "#F0FFF0", "#2F4F4F"]
    },
    {
        id: "twitter",
        name: "Twitter/X Blue",
        description: "Twitter-inspired bright blue primary.",
        colors: ["#1DA1F2", "#14171A", "#F5F8FA"]
    },
    {
        id: "vercel",
        name: "Vercel",
        description: "Iconic black & white theme.",
        colors: ["#000000", "#FFFFFF", "#333333"]
    },
    {
        id: "amethyst-haze",
        name: "Amethyst Haze",
        description: "Soft purple/lavender theme with pink accents.",
        colors: ["#9966CC", "#E6E6FA", "#FFC0CB"]
    }
];

export function getThemeById(id: string): ThemeInfo | undefined {
    return themes.find(t => t.id === id);
}
