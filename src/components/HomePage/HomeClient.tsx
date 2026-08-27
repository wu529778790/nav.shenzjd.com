/**
 * 首页客户端交互层（2026-08-21 树形导航站重构；2026-08-24 URL 驱动化）
 *
 * 数据由服务端 page.tsx 直读 Turso 注入 initialSites（树形结构，最深 5 层）。
 * 布局：Header（搜索）+ 左侧树 + 主区（面包屑 / 标题 meta / Bento 子分类 / 站点网格）。
 * 交互：⌘K 聚焦搜索；Esc 清除搜索。
 *
 * 当前分类由 URL 驱动（SEO，2026-08-24）+ 零请求导航（2026-08-24 性能优化）：
 * - 首页 / → 默认第一个顶级分类；/c/[id] → 直达该分类（SSR 初始化）。
 * - 站内导航（树节点 / 子分类卡片 / 面包屑 / Logo）不再整页刷新：
 *   本地 state 切换 + history.pushState 同步 URL → 零网络请求；
 *   后退/前进由 popstate 从 URL 恢复分类。
 * - <Link href> 保留供爬虫抓取与新标签打开，onClick 拦截走本地切换。
 */

"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AppHeader } from "@/components/layout/AppHeader";
import { Sidebar } from "@/components/HomePage/Sidebar";
import { StaticBoard } from "@/components/HomePage/StaticBoard";
import { BentoSubCategoryGrid } from "@/components/HomePage/BentoGrid";
import { findNode, findPath, countDescendantSites } from "@/lib/nav-tree";
import { formatTopCategoryName } from "@/lib/format";
import type { Category, Site } from "@/types";

/* ============ 树工具函数 ============ */

/** 统计树中总站点数 */
function countTotalSites(categories: Category[]): number {
  let n = 0;
  for (const c of categories) {
    n += c.sites.length;
    if (c.children) n += countTotalSites(c.children);
  }
  return n;
}

/** 树中所有站点平铺（用于全局搜索），带上所属分类路径 */
function flattenTree(categories: Category[]): Array<{
  site: Site;
  category: Category;
  path: Category[];
}> {
  const out: Array<{ site: Site; category: Category; path: Category[] }> = [];
  const walk = (cats: Category[], path: Category[]) => {
    for (const c of cats) {
      const nextPath = [...path, c];
      for (const s of c.sites) {
        out.push({ site: s, category: c, path: nextPath });
      }
      if (c.children) walk(c.children, nextPath);
    }
  };
  walk(categories, []);
  return out;
}

/* ============ 面包屑 ============ */

function Breadcrumb({
  path,
  topIndexMap,
  onNavigate,
}: {
  path: Category[];
  topIndexMap: Map<string, number>;
  onNavigate: (id: string) => void;
}) {
  if (path.length === 0) return null;
  return (
    <nav aria-label="面包屑" className="flex min-w-0 items-center gap-1.5 text-[13px]">
      <span className="text-[var(--muted-foreground)]">神族九帝的收藏夹</span>
      {path.map((c, i) => {
        const isLast = i === path.length - 1;
        const isTop = i === 0;
        const display = isTop ? formatTopCategoryName(c.name, topIndexMap.get(c.id) ?? 0) : c.name;
        return (
          <span key={c.id} className="flex min-w-0 items-center gap-1.5">
            <span className="text-[var(--border-strong)]">/</span>
            {isLast ? (
              <span className="flex min-w-0 items-center gap-1 font-medium text-[var(--foreground)]">
                <span className="truncate">{display}</span>
                {c.sites.length > 0 && (
                  <span className="tabular-nums text-xs text-[var(--muted-foreground)]">
                    {c.sites.length}
                  </span>
                )}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(c.id)}
                className="cursor-pointer truncate text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                {display}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/* ============ 全局搜索结果（按顶级分类分组） ============ */

function GlobalSearchResults({
  results,
  topIndexMap,
  onJumpToCategory,
}: {
  results: Array<{ site: Site; category: Category; path: Category[] }>;
  topIndexMap: Map<string, number>;
  onJumpToCategory: (id: string) => void;
}) {
  const grouped = (() => {
    const map = new Map<string, Array<{ site: Site; category: Category; path: Category[] }>>();
    for (const r of results) {
      const rootId = r.path[0]?.id ?? "未分类";
      if (!map.has(rootId)) map.set(rootId, []);
      map.get(rootId)!.push(r);
    }
    return [...map.entries()];
  })();

  if (results.length === 0) {
    return (
      <div className="empty-state">
        <div className="mb-3 text-3xl">🔍</div>
        <div className="text-lg font-semibold">未找到匹配内容</div>
        <div className="mt-1 text-sm text-[var(--muted-foreground)]">尝试调整搜索词</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {grouped.map(([rootId, items]) => {
        const root = items[0].path[0];
        return (
          <section key={rootId} className="space-y-3">
            <button
              type="button"
              onClick={() => onJumpToCategory(root.id)}
              className="flex cursor-pointer items-center gap-2 text-sm hover:opacity-80"
            >
              <span className="font-medium">
                {formatTopCategoryName(root.name, topIndexMap.get(root.id) ?? 0)}
              </span>
              <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
                {items.length}
              </span>
              <span className="text-xs text-[var(--foreground-secondary)]">查看该分类 →</span>
            </button>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(({ site, path }) => {
                const subPath = path
                  .slice(1)
                  .map((p) => p.name)
                  .join(" / ");
                return (
                  <a
                    key={site.id}
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="site-card group flex min-w-0 flex-col gap-1.5"
                  >
                    <span className="truncate text-sm font-medium text-[var(--foreground)]">
                      {site.title}
                    </span>
                    {subPath && (
                      <span className="truncate text-xs text-[var(--muted-foreground)]">
                        {subPath}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ============ 主组件 ============ */

export default function HomeClient({
  initialSites = [],
  initialActiveCategoryId = null,
  initialReportCounts = {},
  initialLikeCounts = {},
}: {
  initialSites?: Category[];
  /** URL 驱动的当前分类（SEO，2026-08-24）：/c/[id] 传入该 id，首页为空 → 默认第一个顶级分类 */
  initialActiveCategoryId?: string | null;
  /** 全站失效报告数（全局聚合，SSR 注入；用户已报状态由 StaticBoard 客户端拉取） */
  initialReportCounts?: Record<string, number>;
  /** 全站点赞数（全局聚合，SSR 注入；用户已赞状态由 StaticBoard 客户端拉取） */
  initialLikeCounts?: Record<string, number>;
}) {
  const categories = initialSites;

  // 当前分类：本地 state（2026-08-24 零请求导航）。直达 /c/[id] 时由 SSR props 初始化；
  // 站内导航本地切换 + history.pushState 同步 URL，不再整页刷新。
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    () => initialActiveCategoryId ?? categories[0]?.id ?? null
  );

  // 全局搜索词
  const [searchQuery, setSearchQuery] = useState("");

  // 搜索输入引用（⌘K 聚焦）
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 移动端（<768px）：只显示全屏 tree，无右侧主区（2026-08-22 用户拍板）
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const activeCategory = findNode(categories, activeCategoryId);
  const activePath = findPath(categories, activeCategoryId);

  // 顶级分类 id → 0-based 数组下标（用于显示层按索引生成连续编号 01、02…）
  // categories 是 SSR 注入的不可变初始 props，引用稳定
  const topIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach((c, i) => map.set(c.id, i));
    return map;
  }, [categories]);

  // ============ 全局搜索结果（跨整棵树） ============
  const globalSearchResults = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const flat = flattenTree(categories);
    return flat.filter(({ site }) => {
      const haystack = `${site.title}\n${site.description ?? ""}\n${site.url}`.toLowerCase();
      return haystack.includes(q);
    });
  })();

  // 切换分类：本地 state 切换 + history.pushState 同步 URL（零请求；SEO 由 <Link href> 保留）
  const navigateToCategory = (id: string) => {
    setSearchQuery("");
    setActiveCategoryId(id);
    window.history.pushState({ nav: true }, "", `/c/${id}`);
    window.scrollTo(0, 0);
  };

  // 点击 logo：跳转到第一个顶级分类（2026-08-22 用户拍板）
  const handleLogoClick = () => {
    const first = categories[0]?.id;
    setSearchQuery("");
    setActiveCategoryId(first ?? null);
    window.history.pushState({ nav: true }, "", first ? `/c/${first}` : "/");
    window.scrollTo(0, 0);
  };

  // ============ 快捷键 ============
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 后退/前进：从 URL 恢复分类（popstate 由浏览器触发，本地切换，无网络请求）
  useEffect(() => {
    const onPopState = () => {
      const m = window.location.pathname.match(/^\/c\/([^/]+)$/);
      const id = m ? m[1] : null;
      setSearchQuery("");
      setActiveCategoryId(id ?? categories[0]?.id ?? null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [categories]);

  // 本地切换分类后同步 <title>（整页刷新时代由 generateMetadata 完成，此处补本地路径）
  useEffect(() => {
    const displayName = activeCategory
      ? activeCategory.parentId == null
        ? formatTopCategoryName(activeCategory.name, topIndexMap.get(activeCategory.id) ?? 0)
        : activeCategory.name
      : null;
    document.title = displayName ? `${displayName} | 神族九帝的收藏夹` : "神族九帝的收藏夹";
  }, [activeCategory, topIndexMap]);

  const totalSites = countTotalSites(categories);

  return (
    <AppLayout>
      <AppHeader
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onLogoClick={handleLogoClick}
      />

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 items-stretch">
        {/* ========== 左侧树导航（移动端全屏，无右侧主区） ========== */}
        <Sidebar
          categories={categories}
          activeCategoryId={activeCategory?.id ?? null}
          showLeafSites={isMobile}
          onNavigate={navigateToCategory}
        />

        {/* ========== 右侧主区（仅桌面端显示；移动端整体就是 tree） ========== */}
        {!isMobile && (
          <main className="min-w-0 flex-1">
            <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-8">
              {/* 顶部操作栏（sticky）：面包屑 / 搜索状态 */}
              <div className="sticky top-16 z-[40] -mx-4 mb-6 flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--background)]/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
                {globalSearchResults ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span>
                      搜索「<strong>{searchQuery}</strong>」匹配
                      <strong className="ml-1 tabular-nums">
                        {globalSearchResults.length}
                      </strong>{" "}
                      个结果
                    </span>
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="ml-1 cursor-pointer rounded-full p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                      aria-label="清除搜索"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M6 6L18 18M18 6L6 18"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <Breadcrumb path={activePath} topIndexMap={topIndexMap} onNavigate={navigateToCategory} />
                )}

                <span className="ml-auto text-xs tabular-nums text-[var(--muted-foreground)]">
                  {totalSites} 个网站
                </span>
              </div>

              {/* ========== 主内容区 ========== */}
              {globalSearchResults ? (
                <GlobalSearchResults
                  results={globalSearchResults}
                  topIndexMap={topIndexMap}
                  onJumpToCategory={navigateToCategory}
                />
              ) : activeCategory ? (
                <div className="space-y-8">
                  {/* 标题行 + meta */}
                  <div className="space-y-1.5">
                    <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[var(--foreground)]">
                      {activeCategory.parentId == null
                        ? formatTopCategoryName(
                            activeCategory.name,
                            topIndexMap.get(activeCategory.id) ?? 0
                          )
                        : activeCategory.name}
                    </h1>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {activeCategory.children?.length
                        ? `${activeCategory.children.length} 个子分类 · `
                        : ""}
                      {countDescendantSites(activeCategory)} 个网站
                    </p>
                  </div>

                  {/* 子分类 Bento 网格（如果有） */}
                  {activeCategory.children && activeCategory.children.length > 0 && (
                    <section>
                      <h2 className="mb-3 text-[13px] font-semibold text-[var(--foreground)]">
                        子分类
                      </h2>
                      <BentoSubCategoryGrid nodes={activeCategory.children} onNavigate={navigateToCategory} />
                    </section>
                  )}

                  {/* 当前节点站点网格 */}
                  {activeCategory.sites.length > 0 ? (
                    <section>
                      <h2 className="mb-3 text-[13px] font-semibold text-[var(--foreground)]">
                        全部网站
                      </h2>
                      <StaticBoard
                        sites={activeCategory.sites}
                        reportCounts={initialReportCounts}
                        likeCounts={initialLikeCounts}
                      />
                    </section>
                  ) : (
                    activeCategory.children &&
                    activeCategory.children.length === 0 && (
                      <div className="empty-state">
                        <div className="text-lg font-semibold">此分类暂无网站</div>
                      </div>
                    )
                  )}
                </div>
              ) : null}
            </div>
          </main>
        )}
      </div>
    </AppLayout>
  );
}
