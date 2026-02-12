import "./globals.css";

import { ChunkErrorReload } from "@/components/chunk-error-reload";
import { Sonner } from "@/components/ui/sonner";

export const metadata = {
  title: "OpenCel",
  description: "Open source, self-hosted Vercel-style deployments"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ChunkErrorReload />
        {children}
        <Sonner />
      </body>
    </html>
  );
}
