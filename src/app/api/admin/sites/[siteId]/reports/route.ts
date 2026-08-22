/**
 * 后台 · 清除站点失效报告（M3）
 *
 * DELETE /api/admin/sites/:siteId/reports （管理员）
 * → 只清报告、保留站点（误报场景）
 * → { ok: true } / 401 / 404
 */

import { NextResponse } from "next/server";
import { getSessionLogin } from "@/lib/server/auth";
import { siteExists, clearSiteReports } from "@/lib/server/admin";

export const runtime = "nodejs";

export async function DELETE(request: Request, ctx: { params: Promise<{ siteId: string }> }) {
  if (!getSessionLogin(request)) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }
  const { siteId } = await ctx.params;
  if (!(await siteExists(siteId))) {
    return NextResponse.json({ error: "站点不存在" }, { status: 404 });
  }
  await clearSiteReports(siteId);
  return NextResponse.json({ ok: true });
}
