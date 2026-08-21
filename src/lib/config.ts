/**
 * 应用配置
 * 集中管理所有配置项，避免硬编码
 */

// GitHub 仓库配置（仅用于头部 GitHub 图标链接展示）
export const GITHUB_CONFIG = {
  ORIGINAL_OWNER: process.env.NEXT_PUBLIC_GITHUB_OWNER || "wu529778790",
  ORIGINAL_REPO: process.env.NEXT_PUBLIC_GITHUB_REPO || "navhub.shenzjd.com",
} as const;

// 应用配置
export const APP_CONFIG = {
  NAME: "NavHub",
  VERSION: "1.0.0",
  DESCRIPTION: "个人导航网站，数据存储于 Turso 数据库",
  /** 部署站点 URL */
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://navhub.shenzjd.com",
} as const;

// 存储配置
export const STORAGE_CONFIG = {
  USE_PERSISTENT_STORAGE: true, // true: localStorage, false: sessionStorage
  CACHE_DURATION: 24 * 60 * 60 * 1000, // 24小时
  SYNC_DEBOUNCE_MS: 3000, // 3秒防抖
} as const;

// 同步配置
export const SYNC_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 5000, // 5秒
  FORK_POLL_INITIAL_DELAY_MS: 1000, // fork 轮询初始延迟
  FORK_POLL_MAX_ATTEMPTS: 5, // fork 轮询最大次数
  FORK_POLL_BACKOFF_FACTOR: 1.8, // fork 轮询退避系数（初始 1s × 5 次 ≈ 12s 总等待）
} as const;

// 安全配置
export const SECURITY_CONFIG = {
  RATE_LIMIT_MAX_REQUESTS: 10,
  RATE_LIMIT_WINDOW_MS: 60000, // 1分钟
  OAUTH_RATE_LIMIT_MAX_REQUESTS: 5,
  OAUTH_RATE_LIMIT_WINDOW_MS: 60000, // 1分钟
} as const;

// URL 解析配置
export const URL_PARSER_CONFIG = {
  TIMEOUT_MS: 10000, // 10秒
  API_URL: "https://api.microlink.io",
  CACHE_MAX_ENTRIES: 1000,
  RATE_LIMIT_MAX_REQUESTS: 60,
  RATE_LIMIT_WINDOW_MS: 60000, // 1分钟
} as const;

/**
 * 验证配置
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!process.env.TURSO_DATABASE_URL) {
    errors.push("TURSO_DATABASE_URL 未配置");
  }

  if (!process.env.TURSO_AUTH_TOKEN) {
    errors.push("TURSO_AUTH_TOKEN 未配置");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
