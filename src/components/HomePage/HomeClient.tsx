/**
 * 首页客户端交互层（2026-08-21 树形导航站重构）
 *
 * 数据由服务端 page.tsx 直读 Turso 注入 initialSites（树形结构，最深 5 层）。
 * 布局：Header（搜索）+ 左侧树 + 主区（面包屑 / 标题 meta / Bento 子分类 / 站点网格）。
 * 交互：整行热区树导航；⌘K 聚焦搜索；Esc 清除搜索。
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AppHeader } from "@/components/layout/AppHeader";
import { Sidebar } from "@/components/HomePage/Sidebar";
import { StaticBoard } from "@/components/HomePage/StaticBoard";
import { BentoSubCategoryGrid } from "@/components/HomePage/BentoGrid";
import { Menu } from "lucide-react";
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
function findPath(categories: Category[], id: string | null): Category[] {
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

/** 统计节点下挂站点总数（含子孙） */
function countDescendantSites(node: Category): number {
  let n = node.sites.length;
  for (const c of node.children ?? []) n += countDescendantSites(c);
  return n;
}

/* ============ 面包屑 ============ */

function Breadcrumb({ path, onNavigate }: { path: Category[]; onNavigate: (id: string) => void }) {
  if (path.length === 0) return null;
  return (
    <nav aria-label="面包屑" className="flex min-w-0 items-center gap-1.5 text-[13px]">
      <span className="text-[var(--muted-foreground)]">储物间</span>
      {path.map((c, i) => {
        const isLast = i === path.length - 1;
        return (
          <span key={c.id} className="flex min-w-0 items-center gap-1.5">
            <span className="text-[var(--border-strong)]">/</span>
            {isLast ? (
              <span className="flex min-w-0 items-center gap-1 font-medium text-[var(--foreground)]">
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
                className="cursor-pointer truncate text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
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

/* ============ 全局搜索结果（按顶级分类分组） ============ */

function GlobalSearchResults({
  results,
  onJumpToCategory,
}: {
  results: Array<{ site: Site; category: Category; path: Category[] }>;
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
              <span className="font-medium">{root.name}</span>
              <span className="text-xs tabular-nums text-[var(--muted-foreground)]">{items.length}</span>
              <span className="text-xs text-[var(--foreground-secondary)]">查看该分类 →</span>
            </button>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(({ site, path }) => {
                const subPath = path.slice(1).map((p) => p.name).join(" / ");
                return (
                  <a
                    key={site.id}
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="site-card group flex min-w-0 flex-col gap-1.5"
                  >
                    <span className="truncate text-sm font-medium text-[var(--foreground)]">{site.title}</span>
                    {subPath && (
                      <span className="truncate text-xs text-[var(--muted-foreground)]">{subPath}</span>
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

export default function HomeClient({ initialSites = [] }: { initialSites?: Category[] }) {
  const categories = initialSites;

  // 当前选中节点 id（树中任意层）
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    () => categories[0]?.id ?? null
  );

  // 全局搜索词
  const [searchQuery, setSearchQuery] = useState("");

  // 移动端侧栏开关
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // 搜索输入引用（⌘K 聚焦）
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 数据变化时若当前 id 失效，回退到根第一个节点
  useEffect(() => {
    if (!activeCategoryId || !findNode(categories, activeCategoryId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始化回退
      setActiveCategoryId(categories[0]?.id ?? null);
    }
  }, [categories, activeCategoryId]);

  const activeCategory = findNode(categories, activeCategoryId);
  const activePath = findPath(categories, activeCategoryId);

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

  // 切换分类：清除搜索
  const handleCategoryChange = (id: string) => {
    setActiveCategoryId(id);
    setSearchQuery("");
    setMobileSidebarOpen(false);
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

  const totalSites = countTotalSites(categories);

  return (
    <AppLayout>
      <AppHeader searchValue={searchQuery} onSearchChange={setSearchQuery} />

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 items-stretch">
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
          <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-8">
            {/* 顶部操作栏（sticky）：移动端侧栏按钮 + 面包屑 / 搜索状态 */}
            <div className="sticky top-16 z-[40] -mx-4 mb-6 flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--background)]/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background-secondary)] p-1.5 text-[var(--foreground-secondary)] md:hidden"
                aria-label="打开分类导航"
              >
                <Menu className="h-4 w-4" />
              </button>

              {globalSearchResults ? (
                <div className="flex items-center gap-2 text-sm">
                  <span>
                    搜索「<strong>{searchQuery}</strong>」匹配
                    <strong className="ml-1 tabular-nums">{globalSearchResults.length}</strong> 个结果
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="ml-1 cursor-pointer rounded-full p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                    aria-label="清除搜索"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ) : (
                <Breadcrumb path={activePath} onNavigate={handleCategoryChange} />
              )}

              <span className="ml-auto text-xs tabular-nums text-[var(--muted-foreground)]">
                {totalSites} 个网站
              </span>
            </div>

            {/* ========== 主内容区 ========== */}
            {globalSearchResults ? (
              <GlobalSearchResults
                results={globalSearchResults}
                onJumpToCategory={handleCategoryChange}
              />
            ) : activeCategory ? (
              <div className="space-y-8">
                {/* 标题行 + meta */}
                <div className="space-y-1.5">
                  <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[var(--foreground)]">
                    {activeCategory.name}
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
                    <h2 className="mb-3 text-[13px] font-semibold text-[var(--foreground)]">子分类</h2>
                    <BentoSubCategoryGrid
                      nodes={activeCategory.children}
                      onNavigate={handleCategoryChange}
                    />
                  </section>
                )}

                {/* 当前节点站点网格 */}
                {activeCategory.sites.length > 0 ? (
                  <section>
                    <h2 className="mb-3 text-[13px] font-semibold text-[var(--foreground)]">全部网站</h2>
                    <StaticBoard sites={activeCategory.sites} />
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
      </div>
    </AppLayout>
  );
}
