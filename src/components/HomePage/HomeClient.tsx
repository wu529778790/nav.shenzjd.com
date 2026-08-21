/**
 * 首页客户端交互层（树状导航版，2026-08-21）
 *
 * 数据由服务端 page.tsx 直读 Turso 注入 initialSites（树形结构，最深 5 层）。
 * 交互：左侧树导航选中节点 → 右侧显示面包屑 + 子分类入口 + 站点网格；全局搜索跨树。
 */

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Sidebar } from "@/components/HomePage/Sidebar";
import { StaticBoard } from "@/components/HomePage/StaticBoard";
import { EmptyState } from "@/components/HomePage/EmptyState";
import { HomeSkeleton } from "@/components/HomePage/HomeSkeleton";
import { Menu, Search, X, ChevronRight } from "lucide-react";
import type { Category, Site } from "@/types";

/* ============ 树工具函数 ============ */

/** 在树中查找节点 */
function findNode(categories: Category[], id: string | null): Category | null {
  if (!id) return null;
  for (const c of categories) {
    if (c.id === id) return c;
    if (c.children) {
      const found = findNode(c.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** 返回节点到根的路径（根 → 节点） */
function findPath(
  categories: Category[],
  id: string | null
): Category[] {
  if (!id) return [];
  for (const c of categories) {
    if (c.id === id) return [c];
    if (c.children) {
      const sub = findPath(c.children, id);
      if (sub.length > 0) return [c, ...sub];
    }
  }
  return [];
}

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

/* ============ 主组件 ============ */

export default function HomeClient({
  initialSites = [],
}: {
  initialSites?: Category[];
}) {
  const categories = initialSites;

  // 当前选中节点 id（树中任意层）
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    () => categories[0]?.id ?? null
  );

  // 全局搜索词
  const [searchQuery, setSearchQuery] = useState("");

  // 视图模式
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // 移动端侧栏开关
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // 数据变化时若当前 id 失效，回退到根第一个节点
  useEffect(() => {
    if (!activeCategoryId || !findNode(categories, activeCategoryId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始化回退
      setActiveCategoryId(categories[0]?.id ?? null);
    }
  }, [categories, activeCategoryId]);

  const activeCategory = findNode(categories, activeCategoryId);
  const activePath = useMemo(
    () => findPath(categories, activeCategoryId),
    [categories, activeCategoryId]
  );

  // ============ 全局搜索结果（跨整棵树） ============
  const globalSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const flat = flattenTree(categories);
    return flat.filter(({ site }) => {
      const haystack = `${site.title}\n${site.description ?? ""}\n${site.url}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [categories, searchQuery]);

  // 切换分类：清除搜索
  const handleCategoryChange = useCallback((id: string) => {
    setActiveCategoryId(id);
    setSearchQuery("");
    setMobileSidebarOpen(false);
  }, []);

  // ============ 快捷键 ============
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("focus-global-search"));
      }
      if (e.key === "Escape") {
        setSearchQuery("");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const totalSites = useMemo(() => countTotalSites(categories), [categories]);

  // 首屏加载（无数据）时展示 skeleton
  if (categories.length === 0) {
    return (
      <AppLayout>
        <PageContainer>
          <HomeSkeleton />
        </PageContainer>
      </AppLayout>
    );
  }

  const totalMatched = globalSearchResults?.length ?? 0;

  return (
    <AppLayout>
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* ========== 左侧树导航 ========== */}
        <Sidebar
          categories={categories}
          activeCategoryId={activeCategory?.id ?? null}
          onCategoryChange={handleCategoryChange}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        {/* ========== 右侧主区 ========== */}
        <main className="min-w-0 flex-1">
          <PageContainer>
            {/* 顶部操作栏（sticky） */}
            <div className="sticky top-16 z-[40] -mx-4 mb-3 flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--background)]/95 px-4 py-2.5 backdrop-blur">
              {/* 移动端侧栏切换 */}
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background-secondary)] p-1.5 text-[var(--foreground-secondary)] md:hidden"
                aria-label="打开分类导航"
              >
                <Menu className="h-4 w-4" />
              </button>

              {/* 面包屑 / 搜索状态 */}
              {globalSearchResults ? (
                <div className="flex items-center gap-2 text-sm">
                  <Search className="h-4 w-4 text-[var(--primary-600)]" />
                  <span>
                    搜索「<strong>{searchQuery}</strong>」匹配
                    <strong className="ml-1 tabular-nums">{totalMatched}</strong> 个结果
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="ml-1 rounded-full p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                    aria-label="清除搜索"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <Breadcrumb path={activePath} onNavigate={handleCategoryChange} />
              )}

              {/* 全局搜索框 */}
              <GlobalSearchBox value={searchQuery} onChange={setSearchQuery} />

              {/* 视图切换 */}
              <ViewToggle viewMode={viewMode} onChange={setViewMode} />

              <span className="ml-auto text-xs tabular-nums text-[var(--muted-foreground)]">
                {totalSites} 链接
              </span>
            </div>

            {/* ========== 主内容区 ========== */}
            {globalSearchResults ? (
              <GlobalSearchResults
                results={globalSearchResults}
                viewMode={viewMode}
                onJumpToCategory={handleCategoryChange}
              />
            ) : activeCategory ? (
              <div className="space-y-5">
                {/* 子分类入口（如果有） */}
                {activeCategory.children && activeCategory.children.length > 0 && (
                  <SubCategoryGrid
                    nodes={activeCategory.children}
                    onNavigate={handleCategoryChange}
                  />
                )}

                {/* 当前节点站点 */}
                {activeCategory.sites.length > 0 ? (
                  <section>
                    <h3 className="mb-3 flex items-center gap-2 px-1 text-sm font-medium text-[var(--foreground-secondary)]">
                      <span>{activeCategory.icon || "📁"}</span>
                      <span className="truncate">{activeCategory.name}</span>
                      <span className="tabular-nums text-xs text-[var(--muted-foreground)]">
                        {activeCategory.sites.length}
                      </span>
                    </h3>
                    <StaticBoard
                      categories={[{ ...activeCategory }]}
                      viewMode={viewMode}
                    />
                  </section>
                ) : (
                  activeCategory.children &&
                  activeCategory.children.length === 0 && (
                    <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted-foreground)]">
                      此分类暂无链接
                    </div>
                  )
                )}
              </div>
            ) : (
              <EmptyState
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery("")}
              />
            )}
          </PageContainer>
        </main>
      </div>
    </AppLayout>
  );
}

/* ============ 面包屑 ============ */

function Breadcrumb({
  path,
  onNavigate,
}: {
  path: Category[];
  onNavigate: (id: string) => void;
}) {
  if (path.length === 0) return null;
  return (
    <nav aria-label="面包屑" className="flex min-w-0 items-center gap-1 text-sm">
      {path.map((c, i) => {
        const isLast = i === path.length - 1;
        return (
          <span key={c.id} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-[var(--muted-foreground)]" />}
            {isLast ? (
              <span className="flex min-w-0 items-center gap-1.5 font-medium">
                <span className="text-base leading-none flex-shrink-0">{c.icon || "📁"}</span>
                <span className="truncate">{c.name}</span>
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
                className="cursor-pointer truncate text-[var(--foreground-secondary)] transition-colors hover:text-[var(--primary-700)]"
              >
                {c.name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/* ============ 子分类入口网格 ============ */

function SubCategoryGrid({
  nodes,
  onNavigate,
}: {
  nodes: Category[];
  onNavigate: (id: string) => void;
}) {
  return (
    <section>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {nodes.map((child) => {
          const childCount = child.sites.length + countTotalSites(child.children ?? []);
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => onNavigate(child.id)}
              className="group flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background-secondary)] px-3 py-3 text-left transition-all hover:border-[var(--primary-400)] hover:shadow-[var(--shadow-sm)]"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary-600)]/10 text-base">
                {child.icon || "📁"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--foreground)]">
                  {child.name}
                </span>
                <span className="block text-xs text-[var(--muted-foreground)]">
                  {childCount} 链接
                  {child.children && child.children.length > 0
                    ? ` · ${child.children.length} 子分类`
                    : ""}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ============ 全局搜索框 ============ */

function GlobalSearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative ml-2 max-w-md flex-1">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜索链接（标题/描述/URL）... ⌘K"
        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background-secondary)] py-1.5 pl-8 pr-3 text-sm outline-none transition-colors focus:border-[var(--primary-400)] focus:bg-[var(--background-elevated)]"
      />
    </div>
  );
}

/* ============ 视图切换 ============ */

function ViewToggle({
  viewMode,
  onChange,
}: {
  viewMode: "grid" | "list";
  onChange: (mode: "grid" | "list") => void;
}) {
  return (
    <div className="flex flex-shrink-0 items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background-secondary)] p-0.5">
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={`cursor-pointer rounded-[var(--radius-sm)] px-2.5 py-1 text-xs transition-colors ${
          viewMode === "grid"
            ? "bg-[var(--primary-600)] text-white"
            : "text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
        }`}
        aria-label="网格视图"
      >
        网格
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`cursor-pointer rounded-[var(--radius-sm)] px-2.5 py-1 text-xs transition-colors ${
          viewMode === "list"
            ? "bg-[var(--primary-600)] text-white"
            : "text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
        }`}
        aria-label="列表视图"
      >
        列表
      </button>
    </div>
  );
}

/* ============ 全局搜索结果（按分类路径分组） ============ */

function GlobalSearchResults({
  results,
  viewMode,
  onJumpToCategory,
}: {
  results: Array<{ site: Site; category: Category; path: Category[] }>;
  viewMode: "grid" | "list";
  onJumpToCategory: (id: string) => void;
}) {
  // 按顶级分类分组
  const grouped = useMemo(() => {
    const map = new Map<string, Array<{ site: Site; category: Category; path: Category[] }>>();
    for (const r of results) {
      const rootId = r.path[0]?.id ?? "未分类";
      if (!map.has(rootId)) map.set(rootId, []);
      map.get(rootId)!.push(r);
    }
    return [...map.entries()];
  }, [results]);

  return (
    <div className="space-y-6">
      {grouped.map(([rootId, items]) => {
        const root = items[0].path[0];
        return (
          <section key={rootId} className="space-y-3">
            <button
              type="button"
              onClick={() => onJumpToCategory(root.id)}
              className="flex items-center gap-2 text-sm hover:opacity-80"
            >
              <span className="text-base leading-none">{root.icon || "📁"}</span>
              <span className="font-medium">{root.name}</span>
              <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
                {items.length}
              </span>
              <span className="text-xs text-[var(--primary-600)]">查看该分类 →</span>
            </button>
            <div className="space-y-1">
              {items.map(({ site, path }) => {
                const subPath = path.slice(1).map((p) => p.name).join(" / ");
                return (
                  <a
                    key={site.id}
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-1.5 transition-colors hover:bg-[var(--muted)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{site.title}</span>
                      {subPath && (
                        <span className="block truncate text-xs text-[var(--muted-foreground)]">
                          {subPath}
                        </span>
                      )}
                    </span>
                    {viewMode === "grid" ? (
                      <span className="text-[10px] text-[var(--muted-foreground)]">↗</span>
                    ) : null}
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