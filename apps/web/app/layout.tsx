import type { Metadata, Viewport } from "next";
import NextTopLoader from "nextjs-toploader";
import { AuditCaptureUrlBar, AuditCaptureFooter } from "@/components/audit/AuditCaptureChrome";
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
        {/* /icons/ 페이지 진입 아이콘 */}
        <link rel="preload" as="image" href="/icons/inbound-pickup.png" />
        <link rel="preload" as="image" href="/icons/inbound-direct.png" />
        <link rel="preload" as="image" href="/icons/shipping-domestic.png" />
        <link rel="preload" as="image" href="/icons/shipping-overseas.png" />
        {/* 마이페이지 그리드 아이콘 */}
        <link rel="preload" as="image" href="/icon-pickup.png" />
        <link rel="preload" as="image" href="/icon-orders.png" />
        <link rel="preload" as="image" href="/icon-storage.png" />
        <link rel="preload" as="image" href="/icon-addressbook.png" />
        <link rel="preload" as="image" href="/icon-address.png" />
        <link rel="preload" as="image" href="/icon-settings.png" />
        {/* 스토리지 요약 타일 아이콘 */}
        <link rel="preload" as="image" href="/icon-blocks.png" />
        <link rel="preload" as="image" href="/icon-box.png" />
        <link rel="preload" as="image" href="/icon-ship.png" />
        <link rel="preload" as="image" href="/icon-fee.png" />
      </head>
      <body className="flex min-h-full flex-col bg-gray-50 antialiased">
        <NextTopLoader color="#de2910" height={3} showSpinner={false} />
        <AuditCaptureUrlBar />
        <div className="flex flex-1 flex-col">{children}</div>
        <AuditCaptureFooter />
      </body>
    </html>
  );
}
