import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getAllSettings } from "@/server/modules/settings";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getAllSettings().catch(() => null);
  return {
    title: { default: s?.["seo.title"] ?? "Jet Saloon", template: `%s · ${s?.["general.platformName"] ?? "Jet Saloon"}` },
    description: s?.["seo.description"],
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
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
