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
    description: "カンパニーを旗揚げし、ギルと所有率の押し合いで都市を順番に制覇する金融ゲーム。",
    openGraph: {
      title: "タタルの大繁盛店",
      description: "敵の防衛資金を崩し、最後の直接出資で所有率100%へ。都市を制覇して次の交易路を開け。",
      images: [new URL("/og-campaign-v2.png", baseUrl).toString()],
    },
    twitter: {
      card: "summary_large_image",
      title: "タタルの大繁盛店",
      description: "敵の防衛資金を崩し、最後の直接出資で所有率100%へ。都市を制覇して次の交易路を開け。",
      images: [new URL("/og-campaign-v2.png", baseUrl).toString()],
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
