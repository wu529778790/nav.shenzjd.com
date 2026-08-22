/**
 * 后台管理页（M3，GitHub 登录 + 全量站点管理）
 *
 * 服务端组件（force-dynamic）：
 * - 读 admin_session cookie → 校验登录态
 * - 已登录 → SSR 直读第一页站点 + 顶级分类 → AdminClient 渲染
 * - 未登录 → 渲染登录卡片（GitHub OAuth）
 */

import { cookies } from "next/headers";
import { verifySessionToken, adminLogin } from "@/lib/server/auth";
import { getSitesPage, getTopCategories } from "@/lib/server/admin";
import AdminClient, { type SitePage } from "./AdminClient";
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

  let initialPage: SitePage = { items: [], total: 0, page: 1, pageSize: 20 };
  let initialCategories: Awaited<ReturnType<typeof getTopCategories>> = [];
  if (isAdmin) {
    try {
      const [pageData, cats] = await Promise.all([
        getSitesPage({ page: 1, pageSize: 20, sort: "title" }),
        getTopCategories(),
      ]);
      initialPage = pageData;
      initialCategories = cats;
    } catch (e) {
      console.error("后台读取站点列表失败:", e);
    }
  }

  return (
    <AdminClient
      login={isAdmin ? login : null}
      initialPage={initialPage}
      initialCategories={initialCategories}
      error={error}
    />
  );
}
