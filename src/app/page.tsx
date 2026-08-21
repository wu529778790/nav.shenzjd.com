/**
 * 首页（服务端组件）
 *
 * 全站私有 + 数据库模式（2026-08-21 起）：
 * 数据由 RootLayout 服务端直读 Turso 数据库并 SSR 进首屏（真实书签，秒开无骨架）。
 * 页面强制动态渲染，保证每次访问都拿到数据库最新数据。
 */

import HomeClient from "@/components/HomePage/HomeClient";

// 强制动态渲染：每次请求实时读库（数据在 Turso，无需 ISR 缓存）
export const dynamic = "force-dynamic";

export default function Page() {
  return <HomeClient />;
}
