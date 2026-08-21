export const APP_SHELL_URL = "/";
/** Do not precache `/` — it embeds build-specific chunk URLs and causes stale-shell404s after deploy. */
export const STATIC_CACHE_URLS = [] as const;

/**
 * 允许加载图片的域名白名单
 * 移除了通配符 https: 以防止数据泄露和用户追踪
 */
const ALLOWED_IMAGE_ORIGINS = [
  "'self'",
  "data:",
  // Google Favicon 服务
  "https://www.google.com",
  "https://t1.gstatic.com",
  "https://t2.gstatic.com",
  "https://t3.gstatic.com",
  // DuckDuckGo Favicon 服务
  "https://icons.duckduckgo.com",
] as const;

/**
 * Cloudflare Insights 脚本 nonce（构建时注入）
 * 如果需要使用 unsafe-eval 的第三方脚本，建议改用 nonce-based 策略
 */
const CLOUDFLARE_INSIGHTS_ORIGIN = "https://static.cloudflareinsights.com";

export function buildContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    // 移除 unsafe-eval：如果 Cloudflare Insights 需要 eval，应迁移到 nonce-based script loading
    [`script-src 'self' 'unsafe-inline'`, CLOUDFLARE_INSIGHTS_ORIGIN].join(" "),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // 使用明确的域名白名单替代 https: 通配符
    `img-src ${[...ALLOWED_IMAGE_ORIGINS].join(" ")}`,
    [
      "connect-src 'self'",
      "https://api.microlink.io",
      "https://noembed.com",
      CLOUDFLARE_INSIGHTS_ORIGIN.replace("https://", "https://"),
      "https://fonts.googleapis.com",
      "https://icons.duckduckgo.com",
    ].join(" "),
    "frame-ancestors 'none'",
  ].join("; ");
}

export function normalizeExternalAssetUrl(url: string): string {
  if (url.startsWith("http://")) {
    return `https://${url.slice("http://".length)}`;
  }

  return url;
}
