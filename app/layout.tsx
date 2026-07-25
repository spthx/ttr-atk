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
    title: "タタルの大繁盛店",
    description: "自社と傘下企業のギルを積み、競合の防衛資金と所有率を押し切って都市を制覇する金融ゲーム。",
    openGraph: {
      title: "タタルの大繁盛店",
      description: "ギルを積み、魂を奪え。SYNERGYとALLIANCEを束ね、所有率100%まで押し切れ。",
      images: [new URL("/title-hero-v1.png", baseUrl).toString()],
    },
    twitter: {
      card: "summary_large_image",
      title: "タタルの大繁盛店",
      description: "ギルを積み、魂を奪え。SYNERGYとALLIANCEを束ね、所有率100%まで押し切れ。",
      images: [new URL("/title-hero-v1.png", baseUrl).toString()],
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
