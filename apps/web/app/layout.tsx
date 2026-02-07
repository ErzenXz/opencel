import "./globals.css";

import { Sonner } from "@/components/ui/sonner";

export const metadata = {
  title: "OpenCel",
  description: "Self-hosted Vercel-like deployments"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Sonner />
      </body>
    </html>
  );
}
