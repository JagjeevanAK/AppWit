"use client"
import { ArrowUp, Search, LayoutTemplate } from 'lucide-react';
import { cn } from "@/lib/utils"
import { useRef, useState, useEffect } from 'react';
import { themes, ThemeInfo } from '@/lib/themes';

interface InputBoxProps {
    height?: string;
    width?: string;
    maxHeight?: string;
    style?: string;
    onSendMessage?: (message: string, theme?: string) => void;
    animatedPlaceholder?: boolean;
    placeholders?: string[];
    hideThemeButton?: boolean;
}

export default function InputBox({
    width,
    height,
    maxHeight = "max-h-[200px]",
    style,
    onSendMessage,
    animatedPlaceholder = false,
    placeholders = [
        "Ask Agent to create a web app that...",
        "Build a dashboard...",
        "Build a landing page...",
        "Build a mobile app...",
        "Build an e-commerce site...",
    ],
    hideThemeButton = false
}: InputBoxProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [input, setInput] = useState<string>("");
    const [currentPlaceholder, setCurrentPlaceholder] = useState<string>(animatedPlaceholder ? "" : "Type your message...");
    const [placeholderIndex, setPlaceholderIndex] = useState<number>(0);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [charIndex, setCharIndex] = useState<number>(0);

    // Theme state
    const [selectedTheme, setSelectedTheme] = useState<ThemeInfo | null>(null);
    const [showThemePicker, setShowThemePicker] = useState(false);
    const [themeSearch, setThemeSearch] = useState("");
    const themePickerRef = useRef<HTMLDivElement>(null);

    // Click outside handler for theme picker
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (themePickerRef.current && !themePickerRef.current.contains(event.target as Node)) {
                setShowThemePicker(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Animated placeholder effect
    useEffect(() => {
        if (!animatedPlaceholder) {
            return;
        }

        const currentText = placeholders[placeholderIndex];

        if (!isDeleting && charIndex < currentText.length) {
            const timeout = setTimeout(() => {
                setCurrentPlaceholder(currentText.slice(0, charIndex + 1));
                setCharIndex(charIndex + 1);
            }, 100);
            return () => clearTimeout(timeout);
        } else if (!isDeleting && charIndex === currentText.length) {
            const timeout = setTimeout(() => {
                setIsDeleting(true);
            }, 2000);
            return () => clearTimeout(timeout);
        } else if (isDeleting && charIndex > 0) {
            const timeout = setTimeout(() => {
                setCurrentPlaceholder(currentText.slice(0, charIndex - 1));
                setCharIndex(charIndex - 1);
            }, 50);
            return () => clearTimeout(timeout);
        } else if (isDeleting && charIndex === 0) {
            const timeout = setTimeout(() => {
                setIsDeleting(false);
                setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
            }, 0);
            return () => clearTimeout(timeout);
        }
    }, [charIndex, isDeleting, placeholderIndex, animatedPlaceholder, placeholders]);

    const handleInput = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            const maxHeightValue = maxHeight ? parseInt(maxHeight.replace('px', '')) : 300;
            const newHeight = Math.min(textarea.scrollHeight, maxHeightValue);
            textarea.style.height = `${newHeight}px`;
            textarea.style.overflowY = textarea.scrollHeight > maxHeightValue ? 'auto' : 'hidden';
        }
    };

    const handleSend = () => {
        if (input.trim() === "") return;
        if (onSendMessage) {
            onSendMessage(input, selectedTheme?.id);
        }
        setInput("");
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const filteredThemes = themes.filter(t =>
        t.name.toLowerCase().includes(themeSearch.toLowerCase())
    );

    return (
        <div className="relative w-full" style={{ width, height }}>
            {/* Theme Picker Dropdown */}
            {showThemePicker && (
                <div
                    ref={themePickerRef}
                    className="absolute top-full mt-2 left-0 w-80 bg-[#1A1A1A] border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50"
                >
                    <div className="p-3 border-b border-gray-800 flex items-center gap-2">
                        <Search className="w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search themes..."
                            className="bg-transparent border-none outline-none text-sm text-gray-200 w-full placeholder:text-gray-600"
                            value={themeSearch}
                            onChange={(e) => setThemeSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                        <div className="text-xs font-semibold text-gray-500 px-2 py-1">Default themes</div>
                        {filteredThemes.map(theme => (
                            <button
                                key={theme.id}
                                onClick={() => {
                                    setSelectedTheme(theme.id === 'default' ? null : theme);
                                    setShowThemePicker(false);
                                    setThemeSearch("");
                                }}
                                className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                                    (selectedTheme?.id === theme.id) || (!selectedTheme && theme.id === 'default')
                                        ? "bg-blue-600/20 text-blue-400"
                                        : "text-gray-300 hover:bg-gray-800"
                                )}
                            >
                                <span>{theme.name}</span>
                                <div className="flex -space-x-1">
                                    {theme.colors.map((color, i) => (
                                        <div
                                            key={i}
                                            className="w-4 h-4 rounded-full border border-gray-700"
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Input Area */}
            <div
                className={cn(
                    "relative flex flex-col w-full border rounded-3xl bg-[#1e1e1e] border-gray-700 shadow-xl transition-all duration-200 overflow-hidden",
                    "focus-within:border-gray-600 focus-within:ring-1 focus-within:ring-gray-600/50"
                )}
            >
                <textarea
                    ref={textareaRef}
                    autoFocus
                    onInput={handleInput}
                    onChange={(e) => setInput(e.target.value)}
                    className={cn(
                        "w-full resize-none bg-transparent px-4 py-4 text-base outline-none placeholder:text-gray-500 min-h-[60px] text-gray-200 overflow-hidden",
                        style
                    )}
                    placeholder={currentPlaceholder}
                    value={input}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            handleSend()
                        }
                    }}
                />

                {/* Bottom Toolbar */}
                <div className={cn("flex items-center px-3 pb-3 pt-1", hideThemeButton ? "justify-end" : "justify-between")}>
                    {!hideThemeButton && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowThemePicker(!showThemePicker)}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors text-sm font-medium",
                                    selectedTheme
                                        ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                                        : "bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                                )}
                            >
                                <LayoutTemplate className="w-4 h-4" />
                                <span>{selectedTheme ? selectedTheme.name : "Theme"}</span>
                            </button>
                        </div>
                    )}

                    <button
                        className={cn(
                            "inline-flex items-center justify-center rounded-full p-2.5 transition-colors",
                            input.trim()
                                ? "bg-white text-black hover:bg-gray-200"
                                : "bg-gray-700 text-gray-500 cursor-not-allowed"
                        )}
                        onClick={handleSend}
                        disabled={!input.trim()}
                    >
                        <ArrowUp className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}