/**
 * 输入验证工具
 * 使用 Zod 进行严格的输入验证和 XSS 防护
 */

import { z } from "zod";

/**
 * URL 验证 Schema
 */
export const urlSchema = z
  .string()
  .min(1, "URL 不能为空")
  .url("请输入有效的 URL")
  .refine(
    (url) => {
      try {
        const urlObj = new URL(url);
        // 只允许 http 和 https 协议
        return urlObj.protocol === "http:" || urlObj.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "只支持 http 和 https 协议" }
  )
  .refine(
    (url) => {
      // 防止 javascript: 协议
      return !url.toLowerCase().startsWith("javascript:");
    },
    { message: "不允许使用 javascript: 协议" }
  )
  .refine(
    (url) => {
      // 防止 data: 协议（可能包含恶意内容）
      return !url.toLowerCase().startsWith("data:");
    },
    { message: "不允许使用 data: 协议" }
  );

/**
 * 站点标题验证 Schema
 */
export const siteTitleSchema = z
  .string()
  .min(1, "标题不能为空")
  .max(200, "标题不能超过 200 个字符")
  .refine(
    (title) => {
      // 检查是否包含潜在的 XSS 攻击
      const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i, // onclick=, onerror= 等
        /<iframe/i,
        /<object/i,
        /<embed/i,
      ];
      return !dangerousPatterns.some((pattern) => pattern.test(title));
    },
    { message: "标题包含不安全的内容" }
  );

/**
 * Favicon URL 验证 Schema
 */
export const faviconUrlSchema = z
  .string()
  .url("请输入有效的图标 URL")
  .refine(
    (url) => {
      try {
        const urlObj = new URL(url);
        // 允许 http, https, data (用于 base64 图片)
        return (
          urlObj.protocol === "http:" || urlObj.protocol === "https:" || urlObj.protocol === "data:"
        );
      } catch {
        return false;
      }
    },
    { message: "图标 URL 格式不正确" }
  )
  .optional()
  .or(z.literal(""));

/**
 * 分类名称验证 Schema
 */
export const categoryNameSchema = z
  .string()
  .min(1, "分类名称不能为空")
  .max(50, "分类名称不能超过 50 个字符")
  .refine(
    (name) => {
      // 检查是否包含潜在的 XSS 攻击
      const dangerousPatterns = [/<script/i, /javascript:/i, /on\w+\s*=/i];
      return !dangerousPatterns.some((pattern) => pattern.test(name));
    },
    { message: "分类名称包含不安全的内容" }
  );

/**
 * 转义 HTML 特殊字符，防止 XSS
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

/**
 * 清理用户输入（移除危险字符）
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // 移除 script 标签
    .replace(/javascript:/gi, "") // 移除 javascript: 协议
    .replace(/on\w+\s*=/gi, "") // 移除事件处理器
    .trim();
}

/**
 * 验证并清理 URL
 */
export function validateAndSanitizeUrl(url: string): string {
  try {
    const validated = urlSchema.parse(url);
    // 移除可能的查询参数中的危险内容
    const urlObj = new URL(validated);
    // 清理查询参数
    const cleanParams = new URLSearchParams();
    urlObj.searchParams.forEach((value, key) => {
      // 只保留安全的查询参数
      if (!value.toLowerCase().includes("javascript:")) {
        cleanParams.set(key, value);
      }
    });
    urlObj.search = cleanParams.toString();
    return urlObj.toString();
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.issues[0]?.message || "URL 验证失败");
    }
    throw error;
  }
}

/**
 * 验证站点数据
 */
export const siteSchema = z.object({
  id: z.string().min(1),
  title: siteTitleSchema,
  url: urlSchema,
  favicon: faviconUrlSchema,
  description: z.string().max(500).optional(),
  sort: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  _deleted: z.boolean().optional(),
  deletedAt: z.string().optional(),
});

/**
 * 验证分类数据
 */
export const categorySchema = z.object({
  id: z.string().min(1),
  name: categoryNameSchema,
  icon: z.string().optional(),
  sort: z.number(),
  sites: z.array(siteSchema).default([]),
  _deleted: z.boolean().optional(),
  deletedAt: z.string().optional(),
});
