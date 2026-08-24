/**
 * 后台 · 失效报告列表（M3，2026-08-24）
 *
 * GET /api/admin/sites/reported （管理员）
 * → { items: ReportedSite[] }（报告数 > 0 且未删除的站点，按报告数倒序）
 *
 * 供后台「失效报告」tab 使用：集中查看哪些站点被用户报失效，便于核验处理。
 * 静态段 reported 优先于动态段 [siteId]，与站点详情路由不冲突。
 */

import { NextResponse } from "next/server";
import { getSessionLogin } from "@/lib/server/auth";
import { getReportedSites } from "@/lib/server/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!getSessionLogin(request)) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }
  const items = await getReportedSites();
  return NextResponse.json({ items });
}
