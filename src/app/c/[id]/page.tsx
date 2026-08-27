/**
 * 分类独立页 /c/[id]（服务端组件，2026-08-24 SEO；2026-08-24 P0-2 静态化）
 *
 * 每个分类一个可独立收录的 URL：复用 HomeClient 布局（树 + 主区），
 * 通过 initialActiveCategoryId 让页面初始定位到该分类。
 *
 * - ISR（revalidate 6h，与数据缓存 TTL 对齐）：报失效状态已客户端化，
 *   页面不再依赖 per-anon cookie → HTML 可缓存/CDN 直出；数据更新后重启容器重建；
 * - generateMetadata 动态 title/description + canonical；
 * - JSON-LD：BreadcrumbList + ItemList 结构化数据；
 * - 分类不存在或为墓碑 → 404。
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readNavData } from "@/lib/server/turso";
import { getReportCounts } from "@/lib/server/reports";
import { getLikeCounts } from "@/lib/server/likes";
import { findNode, findPath, countDescendantSites, visibleCategories } from "@/lib/nav-tree";
import { stripTopPrefix } from "@/lib/format";
import HomeClient from "@/components/HomePage/HomeClient";
import type { Category } from "@/types";

export const revalidate = 21600;

const SITE_URL = "https://navhub.shenzjd.com";

interface CategoryPageProps {
  params: Promise<{ id: string }>;
}

/** 读取导航数据并定位分类；不存在 / 墓碑返回 null */
async function loadCategory(
  id: string
): Promise<{ node: Category; categories: Category[] } | null> {
  let data;
  try {
    data = await readNavData();
  } catch (error) {
    console.error("分类页读取数据库失败:", error);
    return null;
  }
  if (!data) return null;
  const node = findNode(data.categories, id);
  if (!node || node._deleted) return null;
  return { node, categories: visibleCategories(data.categories) };
}

/** 分类页 BreadcrumbList + ItemList 结构化数据 */
function categoryJsonLd(node: Category, path: Category[]): string {
  const breadcrumbItems = [
    { "@type": "ListItem", position: 1, name: "神族九帝的收藏夹", item: SITE_URL },
    ...path.map((c, i) => ({
      "@type": "ListItem",
      position: i + 2,
      name: stripTopPrefix(c.name),
      item: `${SITE_URL}/c/${c.id}`,
    })),
  ];

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: stripTopPrefix(node.name),
    itemListElement: node.sites.slice(0, 100).map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.title,
      url: s.url,
    })),
  };

  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [{ "@type": "BreadcrumbList", itemListElement: breadcrumbItems }, itemList],
  });
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { id } = await params;
  const loaded = await loadCategory(id);
  if (!loaded) return {};
  const { node } = loaded;
  const count = countDescendantSites(node);
  const samples = node.sites
    .slice(0, 5)
    .map((s) => s.title)
    .join("、");
  const name = stripTopPrefix(node.name);

  return {
    title: name,
    description: `${name}分类导航：收录 ${count} 个优质网站${samples ? `（${samples}）` : ""}，一键直达收藏。`,
    alternates: { canonical: `${SITE_URL}/c/${id}` },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { id } = await params;
  const loaded = await loadCategory(id);
  if (!loaded) notFound();
  const { node, categories } = loaded;

  // 失效报告数（全局聚合，可随 ISR 缓存；用户已报状态由客户端拉取）
  let initialReportCounts: Record<string, number> = {};
  try {
    initialReportCounts = Object.fromEntries(await getReportCounts());
  } catch (error) {
    console.error("分类页读取失效标注失败，降级为空:", error);
  }

  // 点赞数（全局聚合，可随 ISR 缓存；用户已赞状态由客户端拉取）
  let initialLikeCounts: Record<string, number> = {};
  try {
    initialLikeCounts = Object.fromEntries(await getLikeCounts());
  } catch (error) {
    console.error("分类页读取点赞数失败，降级为空:", error);
  }

  const path = findPath(categories, id);
  const jsonLd = categoryJsonLd(node, path);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <HomeClient
        initialSites={categories}
        initialActiveCategoryId={id}
        initialReportCounts={initialReportCounts}
        initialLikeCounts={initialLikeCounts}
      />
    </>
  );
}
