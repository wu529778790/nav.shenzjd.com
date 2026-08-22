/**
 * GitHub OAuth 登录入口（M3 后台）
 *
 * GET /api/auth/github
 * → 生成 state（防 CSRF，存 HttpOnly oauth_state cookie，5 分钟）
 * → 302 到 GitHub authorize
 *
 * 配置兼容：GITHUB_CLIENT_ID 或 NEXT_PUBLIC_GITHUB_CLIENT_ID 均可。
 */

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { githubClientId, hasAuthSecret } from "@/lib/server/auth";

export const runtime = "nodejs";

const STATE_COOKIE = "oauth_state";
const STATE_TTL_SECONDS = 5 * 60;

export async function GET() {
  const clientId = githubClientId();
  if (!clientId) {
    return NextResponse.json(
      {
        error:
          "GITHUB_CLIENT_ID 未配置，无法登录（支持 GITHUB_CLIENT_ID 或 NEXT_PUBLIC_GITHUB_CLIENT_ID）",
      },
      { status: 500 }
    );
  }
  if (!hasAuthSecret()) {
    return NextResponse.json(
      { error: "AUTH_SECRET 未配置或不足 32 字符，无法登录（服务器环境变量必须配置）" },
      { status: 500 }
    );
  }

  const state = randomBytes(16).toString("hex");
  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("scope", "read:user");
  authorizeUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: STATE_TTL_SECONDS,
    path: "/",
  });
  return res;
}
