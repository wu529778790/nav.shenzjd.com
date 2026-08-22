/**
 * 后台 · 失效站点聚合列表（M3）
 *
 * GET /api/admin/dead-sites （管理员）
 * → { sites: DeadSite[] }
 */

import { NextResponse } from "next/server";
import { getSessionLogin } from "@/lib/server/auth";
import { getDeadSites } from "@/lib/server/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!getSessionLogin(request)) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }
  const sites = await getDeadSites();
  return NextResponse.json({ sites });
}
