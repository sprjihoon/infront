import type { NextConfig } from "next";

// Capacitor 빌드 시 NEXT_OUTPUT=export 환경변수 설정
const isCapacitor = process.env.NEXT_OUTPUT === "export";

const nextConfig: NextConfig = {
  ...(isCapacitor && {
    output: "export",
    images: { unoptimized: true },
    trailingSlash: true,
  }),
  async headers() {
    return [
      {
        // 우편번호 검색 페이지 — Daum CDN 스크립트 허용
        source: "/postcode.html",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://t1.daumcdn.net https://*.daumcdn.net https://*.kakao.com;",
          },
        ],
      },
      {
        source: "/postcode",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://t1.daumcdn.net https://*.daumcdn.net https://*.kakao.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
