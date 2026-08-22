/**
 * 登出（M3 后台）
 *
 * POST /api/auth/logout → 清除 admin_session cookie → 302 /admin
 */

import { NextResponse } from "next/server";
import { SESSION_COOKIE, siteOrigin } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.redirect(new URL("/admin", siteOrigin()));
  res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
