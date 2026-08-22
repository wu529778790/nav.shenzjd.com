/**
 * 后台 · 站点分页列表 / 批量删除（M3 后台表格）
 *
 * GET    /api/admin/sites?page=1&pageSize=20&q=xx&categoryId=xx&sort=reports|title|latest
 *        → { items, total, page, pageSize }
 * DELETE /api/admin/sites?ids=a,b,c
 *        → { ok: true, deleted: n }
 */

import { NextResponse } from "next/server";
import { getSessionLogin } from "@/lib/server/auth";
import { getSitesPage, deleteSites } from "@/lib/server/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!getSessionLogin(request)) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
  const q = url.searchParams.get("q") ?? undefined;
  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  const sortParam = url.searchParams.get("sort");
  const sort =
    sortParam === "reports" || sortParam === "title" || sortParam === "latest"
      ? sortParam
      : "title";

  const data = await getSitesPage({ page, pageSize, q, categoryId, sort });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  if (!getSessionLogin(request)) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ error: "未提供站点 id" }, { status: 400 });
  }
  if (ids.length > 500) {
    return NextResponse.json({ error: "单次最多删除 500 个站点" }, { status: 400 });
  }
  await deleteSites(ids);
  return NextResponse.json({ ok: true, deleted: ids.length });
}
