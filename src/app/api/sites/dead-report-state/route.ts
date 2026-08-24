/**
 * 当前匿名用户已报失效的站点 id 列表（GET，2026-08-24 P0-2 静态化前置）
 *
 * 背景：报失效状态原本在 SSR 注入（读 anon_id cookie → per-anon 个性化），
 * 导致页面 HTML 无法被 ISR/CDN 缓存。此端点把它移到客户端拉取：
 * - 无 anon_id cookie → 空数组（只读场景，不下发新 cookie）
 * - 有 cookie → 该用户已报失效的 site_id 列表
 * - 响应不缓存（no-store）：依赖 cookie 的个性化数据
 *
 * 返回：{ reportedSiteIds: string[] }
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getReportedSiteIds } from "@/lib/server/reports";

export const runtime = "nodejs";

const ANON_COOKIE = "anon_id";

export async function GET() {
  const store = await cookies();
  const anonId = store.get(ANON_COOKIE)?.value;
  if (!anonId) {
    return NextResponse.json({ reportedSiteIds: [] });
  }
  try {
    const ids = await getReportedSiteIds(anonId);
    return NextResponse.json({ reportedSiteIds: ids });
  } catch (error) {
    console.error("读取报失效状态失败:", error);
    return NextResponse.json({ reportedSiteIds: [] }, { status: 500 });
  }
}
