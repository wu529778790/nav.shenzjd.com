/**
 * 首页（服务端组件）
 *
 * 纯只读展示站：服务端直读 Turso 数据库 → 过滤墓碑 → SSR 注入 initialSites。
 * 首屏 HTML 即含真实书签（秒开），无客户端同步、无编辑。
 *
 * 静态化策略（2026-08-27 优化）：报失效状态已客户端化（/api/sites/dead-report-state），
 * 页面不再依赖 per-anon cookie → 改回 ISR（revalidate=21600），与分类页对齐。
 * 首次 build 期不连 Turso 会产出空壳，但运行时首次访问会触发 ISR 重建拿到真实数据，
 * 之后 6h 内全部走 Next 数据缓存 + CDN 边缘缓存，DB 读量降到接近 0。
 * （之前的 force-dynamic 让每个未命中 CDN 的请求都重新 SSR，DB 读放大；现已移除。）
 *
 * SEO（2026-08-24）：首页展示默认（第一个）顶级分类，各分类独立页在 /c/[id]；
 * 树/子分类卡片均为可抓取链接，首页附带 ItemList 结构化数据。
 */

import { readNavData } from "@/lib/server/turso";
import { getReportCounts } from "@/lib/server/reports";
import HomeClient from "@/components/HomePage/HomeClient";
import { visibleCategories } from "@/lib/nav-tree";
import { stripTopPrefix } from "@/lib/format";
import type { Category } from "@/types";

// ISR（2026-08-27 改回）：与分类页对齐，6h 重建一次。
// build 期不连 Turso 产出空壳 → 首次运行访问触发 revalidate 重建拿到真实数据，
// 之后全部走 Next ISR 缓存 + CDN 缓存。数据写后靠 invalidateNavCache 主动失效，
// 或重启容器立即重建。
export const revalidate = 21600;

/** 首页 ItemList 结构化数据（默认分类的站点） */
function homepageItemListJsonLd(categories: Category[]): string {
  const root = categories[0];
  if (!root || root.sites.length === 0) return "";
  const items = root.sites.slice(0, 100).map((s, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: s.title,
    url: s.url,
  }));
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: stripTopPrefix(root.name),
    itemListElement: items,
  });
}

export default async function Page() {
  // 服务端直读数据库（失败时降级为空数据，不阻塞页面）
  let initialSites: Category[] = [];
  try {
    const data = await readNavData();
    if (data) {
      initialSites = visibleCategories(data.categories);
    }
  } catch (error) {
    console.error("SSR 读取数据库失败，降级为空数据:", error);
  }

  // 失效报告数（全局聚合，非个性化，可随 ISR 缓存；用户已报状态由客户端拉取）
  let initialReportCounts: Record<string, number> = {};
  try {
    initialReportCounts = Object.fromEntries(await getReportCounts());
  } catch (error) {
    console.error("SSR 读取失效标注失败，降级为空:", error);
  }

  const itemListJson = homepageItemListJsonLd(initialSites);

  return (
    <>
      {itemListJson && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJson }} />
      )}
      <HomeClient
        initialSites={initialSites}
        initialReportCounts={initialReportCounts}
      />
    </>
  );
}
