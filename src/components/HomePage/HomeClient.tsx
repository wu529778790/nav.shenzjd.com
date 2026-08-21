/**
 * 首页客户端交互层（纯只读展示，2026-08-21 重构）
 *
 * 数据由服务端 page.tsx 直读 Turso 注入 initialSites（SSR 秒开），
 * 本组件只做展示交互：左导航切换分类、全局搜索、子主题标签筛选、网格/列表切换。
 * 无编辑、无删除、无同步 —— 数据由 navdata 工具链维护。
 */

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Sidebar } from "@/components/HomePage/Sidebar";
import { SubPathFilter } from "@/components/HomePage/SubPathFilter";
import { StaticBoard } from "@/components/HomePage/StaticBoard";
import { EmptyState } from "@/components/HomePage/EmptyState";
import { HomeSkeleton } from "@/components/HomePage/HomeSkeleton";
import { Menu, Search, X } from "lucide-react";
import type { Category, Site } from "@/types";

export default function HomeClient({
  initialSites = [],
}: {
  initialSites?: Category[];
}) {
  const categories = initialSites;

  // 当前选中的分类（左导航切换）
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    () => categories[0]?.id ?? null
  );

  // 全局搜索词
  const [searchQuery, setSearchQuery] = useState("");

  // 当前分类内子主题标签筛选（多选 OR）
  const [subPathSelected, setSubPathSelected] = useState<string[]>([]);

  // 视图模式
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // 移动端侧栏开关
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // 数据变化时若当前 id 失效，回退到第一个分类
  useEffect(() => {
    if (!activeCategoryId || !categories.find((c) => c.id === activeCategoryId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始化回退
      setActiveCategoryId(categories[0]?.id ?? null);
    }
  }, [categories, activeCategoryId]);

  // 切换分类时清除标签筛选
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 切换分类重置筛选
    setSubPathSelected([]);
  }, [activeCategoryId]);

  const activeCategory =
    categories.find((c) => c.id === activeCategoryId) ?? categories[0];

  // ============ 全局搜索结果（跨所有分类） ============
  const globalSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const results: Array<{ category: Category; sites: Site[] }> = [];
    for (const cat of categories) {
      const matched = cat.sites.filter((s) => {
        const haystack = `${s.title}\n${s.description ?? ""}\n${s.url}`.toLowerCase();
        return haystack.includes(q);
      });
      if (matched.length > 0) results.push({ category: cat, sites: matched });
    }
    return results;
  }, [categories, searchQuery]);

  // ============ 当前分类展示数据 ============
  const currentCategorySites = useMemo(() => {
    if (globalSearchResults) return [];
    if (!activeCategory) return [];
    if (subPathSelected.length === 0) return activeCategory.sites;
    return activeCategory.sites.filter((s) => {
      const tag = (s.description ?? "").split(" · ")[0]?.trim() ?? "";
      return subPathSelected.includes(tag);
    });
  }, [activeCategory, subPathSelected, globalSearchResults]);

  // 切换分类：清除搜索与筛选
  const handleCategoryChange = useCallback((id: string) => {
    setActiveCategoryId(id);
    setSearchQuery("");
    setMobileSidebarOpen(false);
  }, []);

  // 跳转分类（从搜索结果点击）
  const handleJumpToCategory = useCallback((id: string) => {
    setActiveCategoryId(id);
    setSearchQuery("");
  }, []);

  // ============ 快捷键 ============
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K: 聚焦搜索框
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("focus-global-search"));
      }
      // Esc: 清除搜索
      if (e.key === "Escape") {
        setSearchQuery("");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  const totalMatched =
    globalSearchResults?.reduce((n, r) => n + r.sites.length, 0) ?? 0;

  return (
    <AppLayout>
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* ========== 左侧导航 Sidebar ========== */}
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

              {/* 当前分类标题 / 搜索状态 */}
              {globalSearchResults ? (
                <div className="flex items-center gap-2 text-sm">
                  <Search className="h-4 w-4 text-[var(--primary-600)]" />
                  <span>
                    搜索「<strong>{searchQuery}</strong>」匹配
                    <strong className="ml-1 tabular-nums">{totalMatched}</strong> 个结果，
                    跨 <strong className="tabular-nums">{globalSearchResults.length}</strong> 个分类
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
                activeCategory && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-base leading-none">{activeCategory.icon}</span>
                    <span className="font-medium">{activeCategory.name}</span>
                    <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
                      {activeCategory.sites.length}
                    </span>
                  </div>
                )
              )}

              {/* 全局搜索框 */}
              <GlobalSearchBox value={searchQuery} onChange={setSearchQuery} />

              {/* 视图切换 */}
              <ViewToggle viewMode={viewMode} onChange={setViewMode} />
            </div>

            {/* ========== 主内容区 ========== */}
            {globalSearchResults ? (
              <GlobalSearchResults
                results={globalSearchResults}
                viewMode={viewMode}
                onJumpToCategory={handleJumpToCategory}
              />
            ) : activeCategory ? (
              <div className="space-y-4">
                {/* 子主题标签筛选 */}
                <SubPathFilter
                  sites={activeCategory.sites}
                  selected={subPathSelected}
                  onChange={setSubPathSelected}
                />

                {/* 卡片网格 */}
                {currentCategorySites.length > 0 ? (
                  <StaticBoard
                    categories={[{ ...activeCategory, sites: currentCategorySites }]}
                    viewMode={viewMode}
                  />
                ) : (
                  <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted-foreground)]">
                    当前筛选下没有匹配的链接
                  </div>
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

/**
 * 顶部全局搜索框（受控）
 */
function GlobalSearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative ml-2 flex-1 max-w-md">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜索 4000+ 链接（标题/描述/URL）... ⌘K"
        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background-secondary)] py-1.5 pl-8 pr-3 text-sm outline-none transition-colors focus:border-[var(--primary-400)] focus:bg-[var(--background-elevated)]"
      />
    </div>
  );
}

/**
 * 视图切换（网格/列表）
 */
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

/**
 * 全局搜索结果（按分类分组，可点击跳转）
 */
function GlobalSearchResults({
  results,
  viewMode,
  onJumpToCategory,
}: {
  results: Array<{ category: Category; sites: Site[] }>;
  viewMode: "grid" | "list";
  onJumpToCategory: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      {results.map(({ category, sites }) => (
        <section key={category.id} className="space-y-3">
          <button
            type="button"
            onClick={() => onJumpToCategory(category.id)}
            className="flex items-center gap-2 text-sm hover:opacity-80"
          >
            <span className="text-base leading-none">{category.icon || "📁"}</span>
            <span className="font-medium">{category.name}</span>
            <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
              {sites.length}
            </span>
            <span className="text-xs text-[var(--primary-600)]">查看该分类 →</span>
          </button>
          <StaticBoard categories={[{ ...category, sites }]} viewMode={viewMode} />
        </section>
      ))}
    </div>
  );
}