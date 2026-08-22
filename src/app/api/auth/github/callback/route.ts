/**
 * GitHub OAuth 回调（M3 后台）
 *
 * GET /api/auth/github/callback?code&state
 * → 校验 state（防 CSRF）
 * → 用 code 换 access_token
 * → 取 GitHub 用户信息，校验 login === ADMIN_GITHUB_LOGIN
 * → 签发 admin_session cookie → 302 /admin
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import {
  createSessionToken,
  adminLogin,
  SESSION_COOKIE,
  githubClientId,
  githubClientSecret,
  siteOrigin,
} from "@/lib/server/auth";

export const runtime = "nodejs";

const STATE_COOKIE = "oauth_state";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** 清除 oauth_state cookie */
function clearState(res: NextResponse): void {
  res.cookies.set(STATE_COOKIE, "", { maxAge: 0, path: "/" });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;

  // 无论成败都清 state cookie（一次性）
  const fail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/admin?error=${reason}`, siteOrigin()));
    clearState(res);
    return res;
  };

  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    return fail("state");
  }

  // 换 access_token
  let tokenData: { access_token?: string; error?: string };
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: githubClientId(),
        client_secret: githubClientSecret(),
        code,
      }),
    });
    tokenData = await tokenRes.json();
  } catch {
    return fail("network");
  }
  if (!tokenData.access_token) {
    return fail("token");
  }

  // 取用户信息
  let login: string | undefined;
  try {
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json",
        "User-Agent": "navhub-admin",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    const user = (await userRes.json()) as { login?: string };
    login = user.login;
  } catch {
    return fail("network");
  }
  if (!login) {
    return fail("user");
  }
  if (login !== adminLogin()) {
    return fail("forbidden");
  }

  const res = NextResponse.redirect(new URL("/admin", siteOrigin()));
  res.cookies.set(SESSION_COOKIE, createSessionToken(login), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  clearState(res);
  return res;
}
