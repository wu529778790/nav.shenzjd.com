/**
 * 后台管理页（M3，GitHub 登录 + 删除失效站点）
 *
 * 服务端组件（force-dynamic）：
 * - 读 admin_session cookie → 校验登录态
 * - 已登录 → SSR 直读失效站点聚合列表 → AdminClient 渲染
 * - 未登录 → 渲染登录卡片（GitHub OAuth）
 */

import { cookies } from "next/headers";
import { verifySessionToken, adminLogin } from "@/lib/server/auth";
import { getDeadSites } from "@/lib/server/admin";
import AdminClient from "./AdminClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "后台管理",
  robots: { index: false, follow: false },
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  const store = await cookies();
  const login = verifySessionToken(store.get("admin_session")?.value);
  const isAdmin = login === adminLogin();

  let deadSites: Awaited<ReturnType<typeof getDeadSites>> = [];
  if (isAdmin) {
    try {
      deadSites = await getDeadSites();
    } catch (e) {
      console.error("后台读取失效站点失败:", e);
    }
  }

  return <AdminClient login={isAdmin ? login : null} initialSites={deadSites} error={error} />;
}
