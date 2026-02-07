import "./globals.css";

export const metadata = {
  title: "OpenCel",
  description: "Self-hosted Vercel-like deployments"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

