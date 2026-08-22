/**
 * GitHub OAuth 回调（兼容路径）
 *
 * 用户在 GitHub OAuth App 里配置的回调 URL 为
 * https://navhub.shenzjd.com/api/auth/callback/github
 * 与规范路径 /api/auth/github/callback 不同 → 本文件 re-export 同一处理逻辑，
 * 两个路径均可访问（Next.js 支持 route handler re-export）。
 */

export { GET } from "../../github/callback/route";

export const runtime = "nodejs";
