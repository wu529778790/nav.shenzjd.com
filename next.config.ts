import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    // tree-shake 大体积图标/DnD 库的未使用导出，减少客户端 JS
    optimizePackageImports: ["lucide-react", "@dnd-kit/core", "@dnd-kit/sortable"],
  },
  async headers() {
    return [
      {
        // HTML / 页面路由：短缓存 + 后台校验。不再用 no-store，否则 ISR 预渲染的页面
        // 永远无法被 CDN/浏览器缓存，首屏 TTFB 偏高。
        // 配合 page.tsx 的 revalidate=3600：max-age=0 每次回源校验新鲜度，
        // s-maxage 让 CDN 缓存 1 小时，stale-while-revalidate 保证后台刷新时仍秒开。
        //
        // 注意：排除 /api/* —— API 路由（尤其是 /api/auth/session）依赖
        // 请求级 HttpOnly cookie 做鉴权，必须每个请求直达源站，不能被 CDN 缓存。
        // 路由 handler 自己通过 `Cache-Control: no-store` 显式关闭缓存。
        source: "/((?!_next/static|_next/image|favicon.ico|sw\\.js|api/).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;
