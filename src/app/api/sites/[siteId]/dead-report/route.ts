/**
 * 站点「报失效」接口（M2，手动模式）
 *
 * - POST   /api/sites/:siteId/dead-report  → 报失效（幂等）
 * - DELETE /api/sites/:siteId/dead-report  → 取消报失效（幂等）
 *
 * 身份：匿名 HttpOnly `anon_id` cookie（首次请求下发，1 年有效）。
 * 限流：单 anon_id 过去 1h 内新增报告 ≤ 30，超限 429。
 * 返回：{ reported: boolean, count: number }
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getClient, ensureTables } from "@/lib/server/turso";
import { addReport, removeReport, recentReportCount } from "@/lib/server/reports";

export const runtime = "nodejs";

const ANON_COOKIE = "anon_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 年
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1h
const RATE_LIMIT_MAX = 30;

/** 站点是否存在 */
async function siteExists(siteId: string): Promise<boolean> {
  await ensureTables();
  const db = getClient();
  const rs = await db.execute({
    sql: "SELECT id FROM sites WHERE id = ?",
    args: [siteId],
  });
  return rs.rows.length > 0;
}

/** 读取/生成 anon_id */
async function resolveAnonId(): Promise<{ anonId: string; isNew: boolean }> {
  const store = await cookies();
  const existing = store.get(ANON_COOKIE)?.value;
  if (existing) return { anonId: existing, isNew: false };
  return { anonId: crypto.randomUUID(), isNew: true };
}

function jsonWithCookie(
  data: unknown,
  anonId: string,
  isNew: boolean,
  status = 200
): NextResponse {
  const res = NextResponse.json(data, { status });
  if (isNew) {
    res.cookies.set(ANON_COOKIE, anonId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
  }
  return res;
}

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await ctx.params;
  if (!(await siteExists(siteId))) {
    return NextResponse.json({ error: "站点不存在" }, { status: 404 });
  }

  const { anonId, isNew } = await resolveAnonId();
  const recent = await recentReportCount(anonId, Date.now() - RATE_LIMIT_WINDOW_MS);
  if (recent >= RATE_LIMIT_MAX) {
    return jsonWithCookie({ error: "操作太频繁，请稍后再试" }, anonId, isNew, 429);
  }

  const state = await addReport(anonId, siteId);
  return jsonWithCookie(state, anonId, isNew);
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await ctx.params;
  if (!(await siteExists(siteId))) {
    return NextResponse.json({ error: "站点不存在" }, { status: 404 });
  }

  const { anonId, isNew } = await resolveAnonId();
  const state = await removeReport(anonId, siteId);
  return jsonWithCookie(state, anonId, isNew);
}
