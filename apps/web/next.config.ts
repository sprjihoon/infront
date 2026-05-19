import type { NextConfig } from "next";

// Capacitor 빌드 시 NEXT_OUTPUT=export 환경변수 설정
const isCapacitor = process.env.NEXT_OUTPUT === "export";

const nextConfig: NextConfig = {
  ...(isCapacitor && {
    output: "export",
    images: { unoptimized: true },
    trailingSlash: true,
  }),
};

export default nextConfig;
