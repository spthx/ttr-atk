import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const baseUrl = new URL(`${protocol}://${host}`);

  return {
    metadataBase: baseUrl,
    title: "タタル商会 世界交易帳",
    description: "FF14の主要都市と企業連合を、買収と交易で制覇する金融ゲーム。",
    openGraph: {
      title: "タタル商会 世界交易帳",
      description: "買収・交易・資金管理で全都市制覇を目指す金融ゲーム。",
      images: [new URL("/og.png", baseUrl).toString()],
    },
    twitter: {
      card: "summary_large_image",
      title: "タタル商会 世界交易帳",
      description: "買収・交易・資金管理で全都市制覇を目指す金融ゲーム。",
      images: [new URL("/og.png", baseUrl).toString()],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
