import "./globals.css";

import { Inter } from "next/font/google";
import { ChunkErrorReload } from "@/components/chunk-error-reload";
import { Sonner } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "OpenCel",
  description: "Open source, self-hosted Vercel-style deployments"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ChunkErrorReload />
        {children}
        <Sonner />
      </body>
    </html>
  );
}
