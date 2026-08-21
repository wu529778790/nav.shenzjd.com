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
        // HTML / 页面路由：数据库模式（2026-08-21 起）数据实时读 Turso，
        // 页面为 force-dynamic 动态渲染，HTML 不缓存，保证每次访问数据最新。
        // API 路由（/api/*）同样不缓存（路由 handler 自己通过 Cache-Control: no-store 控制）。
        source: "/((?!_next/static|_next/image|favicon.ico|sw\\.js|api/).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
        ],
      },
    ];
  },
  images: {
    // 全站私有模式：无 GitHub 头像等外部远程图片（favicon 走 /api/favicon 代理）
    remotePatterns: [],
  },
};

export default nextConfig;
