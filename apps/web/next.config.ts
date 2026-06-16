import type { NextConfig } from "next";

// Capacitor 빌드 시 NEXT_OUTPUT=export 환경변수 설정
const isCapacitor = process.env.NEXT_OUTPUT === "export";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  ...(isCapacitor && {
    output: "export",
    images: { unoptimized: true },
    trailingSlash: true,
  }),
  async redirects() {
    return [
      { source: "/warehouse", destination: "/storage", permanent: true },
      { source: "/warehouse/:id", destination: "/storage", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // 전체 페이지에 보안 헤더 적용
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // 우편번호 검색 페이지 — Daum CDN 스크립트 허용
        source: "/postcode.html",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://t1.daumcdn.net https://*.daumcdn.net https://*.kakao.com https://*.daum.net;",
          },
        ],
      },
      {
        source: "/postcode",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://t1.daumcdn.net https://*.daumcdn.net https://*.kakao.com https://*.daum.net;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
