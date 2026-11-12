import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Shell } from "@/components/Shell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "NexusML",
  description: "C-MAPSS remaining useful life workbench",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body suppressHydrationWarning>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
