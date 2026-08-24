import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { buildContentSecurityPolicy } from "@/lib/runtime-policies";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Cache-Control 不再由 proxy 写入 — 改由 next.config headers 统一管理
  // （HTML：max-age=0, s-maxage=3600, stale-while-revalidate=86400）。
  // 保留 CSP 在 proxy 写入，避免 prerender/route cache 复用旧 CSP。
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy());
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // HTML 页面缓存（2026-08-24 P0-2）：数据低频变更 + 报失效已客户端化 → 允许 CDN 缓存 6h。
  // 首页走 Next ISR 产物缓存（s-maxage 由 Next 输出）；分类页为动态路由（build 期无 Turso，
  // 无法 generateStaticParams，Next 不产出 ISR 缓存），由这里统一补 CDN 缓存头，让 Cloudflare 边缘直出。
  // s-maxage 只作用于共享缓存（CDN），浏览器不缓存（无 max-age），刷新始终看到最新报告数。
  if (request.nextUrl.pathname === "/" || request.nextUrl.pathname.startsWith("/c/")) {
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=21600, stale-while-revalidate=86400"
    );
  }

  if (request.nextUrl.protocol === "https:") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw\\.js).*)"],
};
