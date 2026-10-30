import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/admin/ems/label': ['./lib/ems/forms/**/*'],
    '/api/admin/epost/label-domestic': [
      './lib/epost/delivery_codes.csv',
      './lib/epost/DroidSansFallback.ttf',
    ],
    '/api/admin/inbound/barcode-pdf': ['./lib/ems/forms/NanumGothic-Regular.ttf'],
  },
};

export default nextConfig;
