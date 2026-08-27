/**
 * 当前匿名用户已点赞的站点 id 列表（GET）
 *
 * 与报失效状态端点同构：个性化数据客户端化，页面 HTML 可被 ISR/CDN 缓存。
 * - 无 anon_id cookie → 空数组（只读场景，不下发新 cookie）
 * - 有 cookie → 该用户已点赞的 site_id 列表
 * - 响应不缓存（no-store）：依赖 cookie 的个性化数据
 *
 * 返回：{ likedSiteIds: string[] }
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getLikedSiteIds } from "@/lib/server/likes";

export const runtime = "nodejs";

const ANON_COOKIE = "anon_id";

export async function GET() {
  const store = await cookies();
  const anonId = store.get(ANON_COOKIE)?.value;
  if (!anonId) {
    return NextResponse.json({ likedSiteIds: [] });
  }
  try {
    const ids = await getLikedSiteIds(anonId);
    return NextResponse.json({ likedSiteIds: ids });
  } catch (error) {
    console.error("读取点赞状态失败:", error);
    return NextResponse.json({ likedSiteIds: [] }, { status: 500 });
  }
}
