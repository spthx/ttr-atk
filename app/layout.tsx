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
    title: "進撃の小人 — Attack on Tataru",
    description: "FF14の主要都市と企業連合を、リアルタイム相場と資金攻防で制覇する金融ゲーム。",
    openGraph: {
      title: "進撃の小人 — Attack on Tataru",
      description: "急騰・急落を読み、ギルを積み、全都市制覇を目指すリアルタイム金融ゲーム。",
      images: [new URL("/og-market-battle.png", baseUrl).toString()],
    },
    twitter: {
      card: "summary_large_image",
      title: "進撃の小人 — Attack on Tataru",
      description: "急騰・急落を読み、ギルを積み、全都市制覇を目指すリアルタイム金融ゲーム。",
      images: [new URL("/og-market-battle.png", baseUrl).toString()],
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
