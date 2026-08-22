/**
 * 登出（M3 后台）
 *
 * POST /api/auth/logout → 清除 admin_session cookie → 302 /admin
 */

import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/admin", request.url));
  res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
