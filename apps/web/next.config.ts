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
      // 주문번호 없이 접근 시 주문 목록(배송조회 진입점)으로 안내
      { source: "/shop/tracking", destination: "/shop/orders", permanent: false },
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
        // KG이니시스 returnUrl — 타 도메인 iframe 내에서 로드되므로 X-Frame-Options 해제
        source: "/api/inicis/:path*",
        headers: [
          { key: "X-Frame-Options", value: "" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      {
        // 샵 빌링 콜백 — KG이니시스 iframe에서 로드
        source: "/api/shop/billing/:path*",
        headers: [
          { key: "X-Frame-Options", value: "" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
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
