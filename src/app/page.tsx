/**
 * 首页（服务端组件）
 *
 * 纯只读展示站：服务端直读 Turso 数据库 → 过滤墓碑 → SSR 注入 initialSites。
 * 首屏 HTML 即含真实书签（秒开），无客户端同步、无编辑。
 */

import { readNavData } from "@/lib/server/turso";
import HomeClient from "@/components/HomePage/HomeClient";
import type { Category, Site } from "@/types";

// 强制动态渲染：每次请求实时读库
export const dynamic = "force-dynamic";

/** 渲染前过滤墓碑条目（数据里可能有 _deleted 标记） */
function visibleCategories(categories: Category[]): Category[] {
  return categories
    .filter((c) => !c._deleted)
    .map((c) => ({
      ...c,
      sites: c.sites.filter((s: Site) => !s._deleted),
    }));
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

  return <HomeClient initialSites={initialSites} />;
}
