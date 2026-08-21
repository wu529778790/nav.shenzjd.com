/**
 * 首页客户端交互层（2026-08-21 重构）
 *
 * 新布局：左导航（Sidebar）+ 右侧主区（顶部操作栏 + 当前分类卡片网格）
 * - 默认显示一个分类（切换式显示，避免 4378 条链接堆一长页）
 * - 全局搜索：跨所有分类过滤，输入时显示全屏搜索结果
 * - 子路径标签：在当前分类内多选筛选（OR 逻辑）
 * - 来源标识：description 中的 "来源: xx" 渲染为徽章
 *
 * 服务端 RootLayout 已 SSR 注入 initialSites（数据库直读，首屏秒开），
 * DataContext 初始化优先用 SSR 数据保证 SSR/CSR 一致。
 */

"use client";

import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import {
  useSitesData,
  useLoadingState,
  useErrorState,
  useCategoryOperations,
  useSitesWithUpdate,
} from "@/contexts/DataContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ImportExportDialog } from "@/components/ImportExportDialog";
import { StaticBoard } from "@/components/HomePage/StaticBoard";
import { Sidebar } from "@/components/HomePage/Sidebar";
import { SubPathFilter } from "@/components/HomePage/SubPathFilter";
import { SiteCard } from "@/components/SiteCard";
import { Menu, X, Search } from "lucide-react";

// 导入拆分后的子组件和 Hooks
import {
  CategoryManager,
  ActionBar,
  EmptyState,
  HomeSkeleton,
} from "@/components/HomePage";

// 拖拽板（含 dnd-kit）按需懒加载，避免把 @dnd-kit 拉入首页首屏关键 JS
const SortableBoard = lazy(() =>
  import("@/components/HomePage/SortableBoard").then((m) => ({
    default: m.SortableBoard,
  }))
);

export default function HomeClient() {
  const contextSites = useSitesData();
  const loading = useLoadingState();
  const { error, clearError } = useErrorState();
  const { addCategory } = useCategoryOperations();
  const { updateSites } = useSitesWithUpdate();

  // 过滤墓碑后用于渲染
  const categories = useMemo(() => contextSites, [contextSites]);

  // 当前选中的分类（受控状态：左导航切换）
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    () => categories[0]?.id ?? null
  );
  // 数据变化时若当前 id 失效，回退到第一个分类
  useEffect(() => {
    if (!activeCategoryId || !categories.find((c) => c.id === activeCategoryId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始化回退：current id 在数据变化时丢失
      setActiveCategoryId(categories[0]?.id ?? null);
    }
  }, [categories, activeCategoryId]);

  const activeCategory =
    categories.find((c) => c.id === activeCategoryId) ?? categories[0];

  // 全局搜索（跨所有分类匹配）
  const [searchQuery, setSearchQuery] = useState("");

  // 当前分类内子路径标签筛选（多选 OR）
  const [subPathSelected, setSubPathSelected] = useState<string[]>([]);
  // 切换分类时清除标签筛选
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 切换分类时重置筛选条件（语义化 reset）
    setSubPathSelected([]);
  }, [activeCategoryId]);

  // 视图模式（卡片网格 / 紧凑列表）
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // 导入导出对话框
  const [showImportExport, setShowImportExport] = useState(false);

  // 移动端侧栏开关
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ============ 全局搜索结果（跨所有分类） ============
  const globalSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const results: Array<{
      category: typeof categories[number];
      sites: typeof categories[number]["sites"];
    }> = [];
    for (const cat of categories) {
      const matched = cat.sites.filter((s) => {
        const haystack = `${s.title}\n${s.description ?? ""}\n${s.url}`.toLowerCase();
        return haystack.includes(q);
      });
      if (matched.length > 0) results.push({ category: cat, sites: matched });
    }
    return results;
  }, [categories, searchQuery]);

  // ============ 当前分类展示数据（搜索时为空） ============
  const currentCategorySites = useMemo(() => {
    if (globalSearchResults) return []; // 搜索态不展示单个分类
    if (!activeCategory) return [];
    if (subPathSelected.length === 0) return activeCategory.sites;
    return activeCategory.sites.filter((s) => {
      const tag = (s.description ?? "").split(" · ")[0]?.trim() ?? "";
      return subPathSelected.includes(tag);
    });
  }, [activeCategory, subPathSelected, globalSearchResults]);

  // ============ 全局快捷键 ============
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Alt + N: 新建分类
      if (
        (e.ctrlKey || e.metaKey) &&
        e.altKey &&
        !e.shiftKey &&
        e.key.toLowerCase() === "n"
      ) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("add-category"));
      }
      // Esc: 关闭所有弹窗 / 清除搜索
      if (e.key === "Escape") {
        if (searchQuery) setSearchQuery("");
        else window.dispatchEvent(new CustomEvent("close-all-dialogs"));
      }
      // Ctrl/Cmd + K: 聚焦搜索框
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("focus-global-search"));
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchQuery]);

  // 首屏加载（无本地缓存、无数据）时展示 skeleton
  if (loading && categories.length === 0) {
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
          onCategoryChange={(id) => {
            setActiveCategoryId(id);
            setMobileSidebarOpen(false);
            setSearchQuery("");
          }}
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

              {/* 操作按钮组 */}
              <div className="flex flex-shrink-0 items-center gap-2 ml-auto">
                <CategoryManager
                  categories={categories}
                  onAddCategory={addCategory}
                  onUpdateSites={updateSites}
                  isGuestMode={false}
                />
                <ActionBar
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  onImportExport={() => setShowImportExport(true)}
                />
              </div>
            </div>

            {/* 错误提示 */}
            {error && <ErrorBanner error={error} onDismiss={clearError} />}

            {/* ========== 主内容区 ========== */}
            {globalSearchResults ? (
              <GlobalSearchResults
                results={globalSearchResults}
                viewMode={viewMode}
                onJumpToCategory={(id) => {
                  setActiveCategoryId(id);
                  setSearchQuery("");
                }}
              />
            ) : activeCategory ? (
              <div className="space-y-4">
                {/* 子路径标签筛选 */}
                <SubPathFilter
                  sites={activeCategory.sites}
                  selected={subPathSelected}
                  onChange={setSubPathSelected}
                />

                {/* 卡片网格 */}
                {currentCategorySites.length > 0 ? (
                  <Suspense
                    fallback={
                      <StaticBoard
                        categories={[
                          { ...activeCategory, sites: currentCategorySites },
                        ]}
                        viewMode={viewMode}
                        isGuestMode={false}
                      />
                    }
                  >
                    <SortableBoard
                      categories={[{ ...activeCategory, sites: currentCategorySites }]}
                      filteredCategories={[{ ...activeCategory, sites: currentCategorySites }]}
                      viewMode={viewMode}
                      isGuestMode={false}
                      onUpdateSites={updateSites}
                    />
                  </Suspense>
                ) : (
                  <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted-foreground)]">
                    当前筛选下没有匹配的链接
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                searchQuery={searchQuery}
                isGuestMode={false}
                onClearSearch={() => setSearchQuery("")}
              />
            )}
          </PageContainer>
        </main>
      </div>

      {/* 导入导出对话框 */}
      <ImportExportDialog open={showImportExport} onOpenChange={setShowImportExport} />
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
        onFocus={(e) => {
          window.addEventListener(
            "focus-global-search",
            () => e.currentTarget.focus(),
            { once: true }
          );
        }}
        placeholder="搜索 4378+ 链接（标题/描述/URL）... ⌘K"
        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background-secondary)] py-1.5 pl-8 pr-3 text-sm outline-none transition-colors focus:border-[var(--primary-400)] focus:bg-[var(--background-elevated)]"
      />
    </div>
  );
}

/**
 * 全局搜索结果（按分类分组，可点击跳转）
 */
import type { Category, Site } from "@/types";

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
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "space-y-2"
            }
          >
            {sites.map((site) => (
              <SiteCard
                key={site.id}
                id={site.id}
                title={site.title}
                url={site.url}
                favicon={site.favicon}
                categoryId={category.id}
                view={viewMode}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ErrorBanner({
  error,
  onDismiss,
}: {
  error: string;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-[var(--error)]/20 bg-[var(--error)]/10 p-4 text-[var(--error)]">
      <span>{error}</span>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 cursor-pointer p-1 text-[var(--error)] transition-colors hover:text-[var(--error)]/70"
        aria-label="关闭错误提示"
      >
        ✕
      </button>
    </div>
  );
}