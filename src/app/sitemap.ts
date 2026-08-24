/**
 * sitemap.xml — 引导搜索引擎发现站点收录的外链 + 分类页（2026-08-24 升级）
 *
 * 数据源：Turso 全量（readNavData 走进程内缓存，零额外 DB 压力），
 * 读取失败时降级 seed 数据（src/data/sites.json），保证 sitemap 始终可用。
 * 条目：
 * - 站点本体（首页）
 * - 全部 381 个分类页 /c/[id]（递归全树）——让爬虫发现每个独立分类页
 * - 全部收录站点外链（导航站 SEO 命脉：顺着 sitemap 抓取导航站收录的外链）
 */

import type { MetadataRoute } from "next";
import { readNavData } from "@/lib/server/turso";
import { visibleCategories } from "@/lib/nav-tree";
import seed from "@/data/sites.json";
import type { Category } from "@/types";

// 读数据库需要动态执行（build 期不连 Turso）；数据本身走缓存，成本可忽略
export const dynamic = "force-dynamic";

const SITE_URL = "https://navhub.shenzjd.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  let categories: Category[] = [];
  try {
    const data = await readNavData();
    if (data) {
      categories = visibleCategories(data.categories);
    }
  } catch (error) {
    console.error("sitemap 读取数据库失败，降级 seed:", error);
  }
  if (categories.length === 0) {
    categories = (seed.categories ?? []) as Category[];
  }

  // 递归收集全部分类页（含子分类）
  const walkCategories = (cats: Category[]) => {
    for (const c of cats) {
      entries.push({
        url: `${SITE_URL}/c/${c.id}`,
        lastModified: c.updatedAt ? new Date(c.updatedAt) : new Date(),
        changeFrequency: "daily",
        priority: 0.7,
      });
      if (c.children) walkCategories(c.children);
    }
  };
  walkCategories(categories);

  // 收录站点外链（更新频率不高）
  for (const category of categories) {
    for (const site of category.sites ?? []) {
      if (site._deleted) continue;
      entries.push({
        url: site.url,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }

  return entries;
}
