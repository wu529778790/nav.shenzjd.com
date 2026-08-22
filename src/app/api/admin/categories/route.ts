/**
 * 后台 · 顶级分类列表（筛选下拉用）
 *
 * GET /api/admin/categories → { categories: [{ id, name, icon }] }
 */

import { NextResponse } from "next/server";
import { getSessionLogin } from "@/lib/server/auth";
import { getTopCategories } from "@/lib/server/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!getSessionLogin(request)) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }
  const categories = await getTopCategories();
  return NextResponse.json({ categories });
}
