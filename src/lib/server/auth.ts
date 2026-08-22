/**
 * 后台鉴权（M3，GitHub OAuth + HMAC session）
 *
 * 无第三方依赖：Node crypto HMAC-SHA256 签名。
 * Session token 格式：`base64url(payload).base64url(hmac)`
 * payload = JSON { sub: githubLogin, exp: unixSeconds }
 *
 * 环境变量：
 * - AUTH_SECRET          签名密钥（≥32 字符，生产必须配置）
 * - ADMIN_GITHUB_LOGIN   唯一管理员 GitHub 登录名（默认 wu529778790）
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "admin_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 天

/** 唯一管理员 GitHub 登录名 */
export function adminLogin(): string {
  return process.env.ADMIN_GITHUB_LOGIN?.trim() || "wu529778790";
}

/** GitHub OAuth client_id（兼容 NEXT_PUBLIC_ 前缀，服务器可能两种命名） */
export function githubClientId(): string {
  return (
    process.env.GITHUB_CLIENT_ID?.trim() || process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID?.trim() || ""
  );
}

/** GitHub OAuth client_secret */
export function githubClientSecret(): string {
  return process.env.GITHUB_CLIENT_SECRET?.trim() || "";
}

/** 签名密钥是否已配置（≥32 字符） */
export function hasAuthSecret(): boolean {
  const s = process.env.AUTH_SECRET?.trim();
  return Boolean(s && s.length >= 32);
}

/**
 * 站点外部地址（用于构造重定向绝对 URL）。
 *
 * 不能依赖 request.url 的 host：容器内 HOSTNAME=0.0.0.0，反代转发时
 * request 的 host 是内部地址（如 0.0.0.0:3000），会导致登录后跳错域名。
 * 默认写死本站域名，换域名时用 APP_URL 环境变量覆盖。
 */
export function siteOrigin(): string {
  return process.env.APP_URL?.trim() || "https://navhub.shenzjd.com";
}

function secret(): string {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET 未配置或长度不足 32 字符（后台登录必需）");
  }
  return s;
}

/** HMAC-SHA256 → base64url */
function sign(input: string): string {
  return createHmac("sha256", secret()).update(input).digest("base64url");
}

/** base64url 安全解码（非法输入返回 null） */
function safeDecode(input: string): Buffer | null {
  try {
    return Buffer.from(input, "base64url");
  } catch {
    return null;
  }
}

/** 签发 session token（sub = GitHub 登录名） */
export function createSessionToken(sub: string): string {
  const payload = {
    sub,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

/** 校验 session token → GitHub 登录名；非法/过期/篡改返回 null */
export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sig] = parts;
  const payloadBuf = safeDecode(payloadB64);
  if (!payloadBuf) return null;

  // 重算签名并 timingSafeEqual 比对（防时序攻击）
  const expected = Buffer.from(sign(payloadB64), "utf8");
  const actual = Buffer.from(sig, "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  let payload: { sub?: string; exp?: number };
  try {
    payload = JSON.parse(payloadBuf.toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload.sub;
}

/** 从 Request cookies 读取登录态；返回 null 表示未登录/非法 */
export function getSessionLogin(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!match) return null;
  const login = verifySessionToken(decodeURIComponent(match[1]));
  if (!login) return null;
  return login === adminLogin() ? login : null;
}
