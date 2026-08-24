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
    // HTML 缓存策略（2026-08-24 P0-2）：不再在 next.config 强制 Cache-Control。
    // 页面已改为 ISR（revalidate=21600，报失效状态客户端化，无 per-anon 依赖），
    // 由 Next 自身输出 `Cache-Control: s-maxage=21600, stale-while-revalidate`，
    // 可被 CDN（Cloudflare）边缘缓存。API 路由由各 handler 自控 no-store。
    return [];
  },
  images: {
    // 全站私有模式：无 GitHub 头像等外部远程图片（favicon 走 /api/favicon 代理）
    remotePatterns: [],
  },
};

export default nextConfig;
