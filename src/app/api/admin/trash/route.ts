/**
 * 后台 · 垃圾箱（回收站）
 *
 * GET    /api/admin/trash              → { items: TrashSite[] }
 * POST   /api/admin/trash/restore      → body { ids: string[] } 恢复
 * DELETE /api/admin/trash?ids=a,b,c    → 永久删除（清报告）
 */

import { NextResponse } from "next/server";
import { getSessionLogin } from "@/lib/server/auth";
import { getTrashSites, restoreSites, purgeSites } from "@/lib/server/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!getSessionLogin(request)) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }
  const items = await getTrashSites();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  if (!getSessionLogin(request)) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }
  let body: { ids?: unknown };
  try {
    body = (await request.json()) as { ids?: unknown };
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string").map((s) => s.trim())
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "未提供站点 id" }, { status: 400 });
  }
  await restoreSites(ids);
  return NextResponse.json({ ok: true, restored: ids.length });
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
    return NextResponse.json({ error: "单次最多永久删除 500 个站点" }, { status: 400 });
  }
  await purgeSites(ids);
  return NextResponse.json({ ok: true, purged: ids.length });
}
