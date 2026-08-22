import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#071a2a",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const baseUrl = new URL(`${protocol}://${host}`);

  return {
    metadataBase: baseUrl,
    title: "タタルの大繁盛商店",
    description: "スーパーファミコン時代のロマンシング サ・ガ3トレードゲームを、FF14の世界観で再現した非公式ファンゲーム。",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        {
          url: "/ff14-fankit/app-icons/tataru-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          url: "/ff14-fankit/app-icons/tataru-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
      apple: [
        {
          url: "/ff14-fankit/app-icons/apple-touch-icon.png",
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "タタル商店",
    },
    openGraph: {
      title: "タタルの大繁盛商店",
      description: "ロマンシング サ・ガ3のトレードをFF14世界で。ギルを積み、仲間と世界の交易路を広げよう。",
      images: [new URL("/title-hero-v1.png", baseUrl).toString()],
    },
    twitter: {
      card: "summary_large_image",
      title: "タタルの大繁盛商店",
      description: "ロマンシング サ・ガ3のトレードをFF14世界で。ギルを積み、仲間と世界の交易路を広げよう。",
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
