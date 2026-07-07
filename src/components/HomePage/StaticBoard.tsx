"use client";

/**
 * 静态内容板（非拖拽、零重型依赖）
 *
 * 作为 SortableBoard 的 Suspense 回退：在 dnd-kit chunk 尚未下载完成时，
 * 立即用极简链接卡片渲染真实分类与站点，避免白屏 / 空壳。
 *
 * 关键约束：本文件不得引入 @dnd-kit，也不得引入 SiteCard（其依赖链含
 * EditSiteDialog → validation/zod 等重型模块）。这里只用轻量的 <a> + FaviconImage，
 * 保证回退本身几乎零依赖，不会把 zod 等拉回首屏关键路径。
 */

import { Edit2, Trash2 } from "lucide-react";
import { IconFolder } from "@/components/icons";
import { FaviconImage } from "@/components/FaviconImage";
import type { Category } from "@/lib/storage/local-storage";

interface StaticSite {
  id: string;
  title: string;
  url: string;
  favicon?: string;
}

interface StaticBoardProps {
  categories: Category[];
  viewMode: "grid" | "list";
  isGuestMode: boolean;
}

/** 极简链接卡片：仅渲染 <a> + favicon + 标题，避免引入 zod / 弹窗等重型依赖 */
function StaticSiteCard({
  site,
  view,
}: {
  site: StaticSite;
  view: "grid" | "list";
}) {
  if (view === "list") {
    return (
      <a
        href={site.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] hover:bg-[var(--muted)] transition-colors"
      >
        <FaviconImage
          src={site.favicon}
          alt={site.title}
          size={20}
          imageClassName="h-5 w-5 rounded"
          iconClassName="h-5 w-5 rounded"
        />
        <span className="truncate text-sm">{site.title}</span>
      </a>
    );
  }

  return (
    <a
      href={site.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-[100px] h-[100px] flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] p-2 text-center transition-colors hover:bg-[var(--muted)]"
    >
      <FaviconImage
        src={site.favicon}
        alt={site.title}
        size={32}
        imageClassName="h-8 w-8 rounded"
        iconClassName="h-8 w-8 rounded"
      />
      <span className="line-clamp-2 text-xs leading-tight">{site.title}</span>
    </a>
  );
}

export function StaticBoard({
  categories,
  viewMode,
  isGuestMode,
}: StaticBoardProps) {
  return (
    <div className="space-y-4">
      {categories.map((category) => (
        <div
          key={category.id}
          className="category-card group"
          id={`category-${category.id}`}
        >
          {/* 分类标题行 */}
          <div className="flex items-center gap-3 mb-3 px-1 py-2 -mx-1 rounded-[var(--radius-md)] hover:bg-[var(--muted)]/50 transition-colors">
            <div className="text-[var(--muted-foreground)] p-0.5 rounded">
              <IconFolder className="w-4 h-4 text-[var(--primary-600)]" />
            </div>
            <h3 className="font-semibold text-[15px] tracking-tight text-[var(--foreground)] flex items-center gap-2 flex-1 min-w-0">
              <span className="truncate">{category.name}</span>
              <span className="text-xs font-normal text-[var(--muted-foreground)] tabular-nums flex-shrink-0">
                {category.sites.length}
              </span>
            </h3>

            {!isGuestMode && (
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(
                      new CustomEvent("edit-category", { detail: category })
                    );
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--muted)] cursor-pointer"
                  title="编辑分类"
                >
                  <Edit2 className="w-3.5 h-3.5 text-[var(--foreground-secondary)]" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(
                      new CustomEvent("delete-category", { detail: category.id })
                    );
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--error)]/10 cursor-pointer"
                  title="删除分类"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[var(--foreground-secondary)] hover:text-[var(--error)]" />
                </button>
              </div>
            )}
          </div>

          {/* 站点网格 / 列表 */}
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2 mt-2 w-full"
                : "flex flex-col gap-2 mt-2"
            }
          >
            {category.sites.map((site) => (
              <StaticSiteCard
                key={site.id}
                site={site}
                view={viewMode}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
