import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "인프론트",
  description: "해외배송 대행 서비스",
  manifest: "/manifest.json?v=3",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "인프론트",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#de2910",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="h-full">
      <head>
        {/* 아이콘 PNG 사전 로드 — 첫 진입 시 깜빡임 방지 */}
        <link rel="preload" as="image" href="/icons/inbound-pickup.png" />
        <link rel="preload" as="image" href="/icons/inbound-direct.png" />
        <link rel="preload" as="image" href="/icons/shipping-domestic.png" />
        <link rel="preload" as="image" href="/icons/shipping-overseas.png" />
      </head>
      <body className="h-full bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
