import { cn } from "@/lib/utils";

interface LoaderProps {
    size?: "sm" | "md" | "lg";
    className?: string;
    text?: string;
}

const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-[3px]",
};

export function Loader({ size = "md", className, text }: LoaderProps) {
    return (
        <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
            <div
                className={cn(
                    "animate-spin rounded-full border-border border-t-primary",
                    sizeClasses[size]
                )}
            />
            {text && (
                <p className="text-muted-foreground text-sm font-medium">{text}</p>
            )}
        </div>
    );
}
