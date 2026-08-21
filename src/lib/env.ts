/**
 * 环境变量验证
 * 确保所有必需的环境变量都已正确设置
 */

import { z } from "zod";

/**
 * 环境变量 Schema
 */
const envSchema = z.object({
  // Node 环境
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // GitHub 仓库链接展示配置（可选，仅用于头部 GitHub 图标链接）
  NEXT_PUBLIC_GITHUB_OWNER: z.string().default("wu529778790"),
  NEXT_PUBLIC_GITHUB_REPO: z.string().default("navhub.shenzjd.com"),
});

/**
 * 验证后的环境变量类型
 */
export type Env = z.infer<typeof envSchema>;

/**
 * 验证环境变量
 * @throws {Error} 如果验证失败
 */
function validateEnv(): Env {
  try {
    // 只验证浏览器可访问的环境变量（NEXT_PUBLIC_*）
    const browserEnv = {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_GITHUB_OWNER: process.env.NEXT_PUBLIC_GITHUB_OWNER,
      NEXT_PUBLIC_GITHUB_REPO: process.env.NEXT_PUBLIC_GITHUB_REPO,
    };

    return envSchema.parse(browserEnv);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map((issue) => issue.message);
      throw new Error(`环境变量验证失败:\n${messages.join("\n")}`);
    }
    throw error;
  }
}

/**
 * 获取验证后的环境变量
 * 这个函数在首次调用时会验证环境变量，之后返回缓存的结果
 */
let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}

/**
 * 检查是否为开发环境
 */
export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === "development";
}

/**
 * 检查是否为生产环境
 */
export function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}

/**
 * 检查是否为测试环境
 */
export function isTest(): boolean {
  return getEnv().NODE_ENV === "test";
}

/**
 * 获取 GitHub 仓库所有者（仅用于 UI 展示）
 */
export function getGitHubOwner(): string {
  return getEnv().NEXT_PUBLIC_GITHUB_OWNER;
}

/**
 * 获取 GitHub 仓库名称（仅用于 UI 展示）
 */
export function getGitHubRepo(): string {
  return getEnv().NEXT_PUBLIC_GITHUB_REPO;
}
