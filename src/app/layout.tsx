import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getAllSettings } from "@/server/modules/settings";
import { appUrl } from "@/server/app-url";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getAllSettings().catch(() => null);
  return {
    title: { default: s?.["seo.title"] ?? "Muv", template: `%s · ${s?.["general.platformName"] ?? "Muv"}` },
    description: s?.["seo.description"],
    metadataBase: new URL(appUrl()),
  };
}
export const viewport: Viewport = { themeColor: "#1769D2", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
