/**
 * 后台 · 单站点管理（M3）
 *
 * DELETE /api/admin/sites/:siteId → 删除站点（连带清报告）
 * PATCH  /api/admin/sites/:siteId → 更新站点信息（title/url/description/favicon）
 * → { ok: true } / 401 / 404 / 400
 */

import { NextResponse } from "next/server";
import { getSessionLogin } from "@/lib/server/auth";
import { siteExists, deleteSite, updateSite } from "@/lib/server/admin";

export const runtime = "nodejs";

export async function DELETE(request: Request, ctx: { params: Promise<{ siteId: string }> }) {
  if (!getSessionLogin(request)) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }
  const { siteId } = await ctx.params;
  if (!(await siteExists(siteId))) {
    return NextResponse.json({ error: "站点不存在" }, { status: 404 });
  }
  await deleteSite(siteId);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ siteId: string }> }) {
  if (!getSessionLogin(request)) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }
  const { siteId } = await ctx.params;
  if (!(await siteExists(siteId))) {
    return NextResponse.json({ error: "站点不存在" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  body ??= {};

  const title = typeof body.title === "string" ? body.title.trim() : undefined;
  const url = typeof body.url === "string" ? body.url.trim() : undefined;
  const description =
    typeof body.description === "string"
      ? body.description.trim()
      : body.description === null
        ? null
        : undefined;
  const favicon =
    typeof body.favicon === "string"
      ? body.favicon.trim()
      : body.favicon === null
        ? null
        : undefined;

  if (title !== undefined && title.length === 0) {
    return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  }
  if (url !== undefined && url.length === 0) {
    return NextResponse.json({ error: "URL 不能为空" }, { status: 400 });
  }
  if (
    title === undefined &&
    url === undefined &&
    description === undefined &&
    favicon === undefined
  ) {
    return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 });
  }

  await updateSite(siteId, { title, url, description, favicon });
  return NextResponse.json({ ok: true });
}
