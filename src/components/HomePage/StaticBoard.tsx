"use client";

/**
 * 静态内容板（纯只读展示，2026-08-21 重构）
 *
 * 零重型依赖：极简链接卡片（favicon + 标题 + 描述），支持网格 / 列表两种视图。
 * 无编辑、无拖拽 —— 数据由 navdata 工具链维护，前端只负责展示。
 */

import { IconFolder } from "@/components/icons";
import { FaviconImage } from "@/components/FaviconImage";
import type { Category, Site } from "@/types";

interface StaticBoardProps {
  categories: Category[];
  viewMode: "grid" | "list";
}

/** 极简链接卡片：favicon + 标题 + 描述 */
function StaticSiteCard({ site, view }: { site: Site; view: "grid" | "list" }) {
  if (view === "list") {
    return (
      <a
        href={site.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-[var(--radius-md)] p-3 transition-colors hover:bg-[var(--muted)]"
      >
        <FaviconImage
          src={site.favicon}
          alt={site.title}
          size={20}
          imageClassName="h-5 w-5 rounded flex-shrink-0"
          iconClassName="h-5 w-5 rounded flex-shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{site.title}</span>
          {site.description && (
            <span className="block truncate text-xs text-[var(--muted-foreground)]">
              {site.description}
            </span>
          )}
        </span>
      </a>
    );
  }

  return (
    <a
      href={site.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] p-2 text-center transition-colors hover:bg-[var(--muted)]"
    >
      <FaviconImage
        src={site.favicon}
        alt={site.title}
        size={32}
        imageClassName="h-8 w-8 rounded flex-shrink-0"
        iconClassName="h-8 w-8 rounded flex-shrink-0"
      />
      <span className="line-clamp-2 text-xs leading-tight">{site.title}</span>
      {site.description && (
        <span className="line-clamp-1 w-full text-[10px] text-[var(--muted-foreground)]">
          {site.description}
        </span>
      )}
    </a>
  );
}

export function StaticBoard({ categories, viewMode }: StaticBoardProps) {
  return (
    <div className="space-y-4">
      {categories.map((category) => (
        <div key={category.id} className="category-card group" id={`category-${category.id}`}>
          {/* 分类标题行 */}
          <div className="-mx-1 mb-3 flex items-center gap-3 rounded-[var(--radius-md)] px-1 py-2 transition-colors hover:bg-[var(--muted)]/50">
            <div className="rounded p-0.5 text-[var(--muted-foreground)]">
              <IconFolder className="h-4 w-4 text-[var(--primary-600)]" />
            </div>
            <h3 className="flex min-w-0 flex-1 items-center gap-2 text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
              <span className="truncate">{category.name}</span>
              <span className="flex-shrink-0 text-xs font-normal tabular-nums text-[var(--muted-foreground)]">
                {category.sites.length}
              </span>
            </h3>
          </div>

          {/* 站点网格 / 列表 */}
          <div
            className={
              viewMode === "grid"
                ? "mt-2 grid w-full grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2"
                : "mt-2 flex flex-col gap-2"
            }
          >
            {category.sites.map((site) => (
              <StaticSiteCard key={site.id} site={site} view={viewMode} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}