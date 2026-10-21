import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Middleware CRM rotalarında da çalıştığı için büyük video yüklemelerinin kesilmemesi gerekir.
    middlewareClientMaxBodySize: "250mb",
  },
  async headers() {
    return [
      {
        // Demo: hiçbir sayfa arama motorlarınca indekslenmesin.
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
