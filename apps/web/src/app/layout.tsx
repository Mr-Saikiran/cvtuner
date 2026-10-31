import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Onest, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({ subsets: ["latin"], weight: ["700"], variable: "--font-syne", display: "swap" });
const onest = Onest({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-onest", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "CVTuner by TechSwitch",
  description: "Tune your resume to any job description. Rule-based or AI. Exports PDF and Word, always within 2 pages.",
  manifest: "/cvtuner/manifest.webmanifest",
  icons: { icon: "/cvtuner/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#16130f" },
  ],
};

/** Reads the saved mode before first paint so the page never flashes the wrong one. */
const MODE_SCRIPT = `try{var m=localStorage.getItem("cvtuner.mode.v1");if(m==="dark"||m==="light")document.documentElement.dataset.mode=m}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${onest.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
