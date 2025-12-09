import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Next.js App",
    description: "Built with Next.js, TypeScript, Tailwind CSS, and shadcn/ui",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="bg-white antialiased">
                {children}
            </body>
        </html>
    );
}
