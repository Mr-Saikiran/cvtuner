import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CVTuner by TechSwitch",
  description: "Tune your resume to any job description. Rule-based or AI. Exports PDF and Word, always within 2 pages.",
  manifest: "/cvtuner/manifest.webmanifest",
  icons: { icon: "/cvtuner/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2a56d6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
