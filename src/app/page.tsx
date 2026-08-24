/**
 * 首页（服务端组件）
 *
 * 纯只读展示站：服务端直读 Turso 数据库 → 过滤墓碑 → SSR 注入 initialSites。
 * 首屏 HTML 即含真实书签（秒开），无客户端同步、无编辑。
 *
 * 读量优化（2026-08-24）：页面本身保持动态渲染，但 DB 读走进程内缓存——
 * readNavData 命中缓存时零数据库读（默认 TTL 6 小时），仅报失效等写入才打库。
 *
 * SEO（2026-08-24）：首页展示默认（第一个）顶级分类，各分类独立页在 /c/[id]；
 * 树/子分类卡片均为可抓取链接，首页附带 ItemList 结构化数据。
 */

import { readNavData } from "@/lib/server/turso";
import { getReportCounts, getReportedSiteIds } from "@/lib/server/reports";
import { cookies } from "next/headers";
import HomeClient from "@/components/HomePage/HomeClient";
import { visibleCategories } from "@/lib/nav-tree";
import { stripTopPrefix } from "@/lib/format";
import type { Category } from "@/types";

// 强制动态渲染：HTML 不缓存（失效标注是 per-anon 个性化数据）；
// 数据库读量由数据层缓存（turso.ts / reports.ts）承接
export const dynamic = "force-dynamic";

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

  // 失效标注（M2）：报告数 map + 当前 anon_id 已报的站点（失败降级为空）
  let initialReportCounts: Record<string, number> = {};
  let initialReportedSiteIds: string[] = [];
  try {
    const store = await cookies();
    const anonId = store.get("anon_id")?.value;
    const [counts, reported] = await Promise.all([
      getReportCounts(),
      anonId ? getReportedSiteIds(anonId) : Promise.resolve<string[]>([]),
    ]);
    initialReportCounts = Object.fromEntries(counts);
    initialReportedSiteIds = reported;
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
        initialReportedSiteIds={initialReportedSiteIds}
      />
    </>
  );
}
