"use client";

/**
 * 静态站点板（2026-08-21 树形导航站重构）
 *
 * 站点卡片网格：favicon + 标题 + 描述 + 标签 chip（黄=官方直解 / 灰=备用链接）。
 * 无编辑、无拖拽 —— 数据由 navdata 工具链维护，前端只负责展示。
 */

import { FaviconImage } from "@/components/FaviconImage";
import type { Site } from "@/types";

interface StaticBoardProps {
  sites: Site[];
}

/** 标签 chip：备用地址 → 灰色「备用链接」；其余描述 → 描述文本 */
function SiteTags({ site }: { site: Site }) {
  if (!site.description) return null;

  // 导入脚本约定：mirror 类型 description = "备用地址"
  if (site.description === "备用地址" || site.description.includes("备用")) {
    return (
      <span className="inline-flex h-[22px] items-center rounded-[var(--radius-xs)] bg-[var(--muted)] px-2 text-[11px] font-medium text-[var(--foreground-secondary)]">
        备用链接
      </span>
    );
  }

  return (
    <span className="truncate text-[13px] leading-snug text-[var(--muted-foreground)]">
      {site.description}
    </span>
  );
}

/** 单个站点卡片 */
function StaticSiteCard({ site }: { site: Site }) {
  return (
    <a
      href={site.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${site.title}\n${site.url}`}
      className="site-card group flex min-w-0 flex-col gap-2.5"
    >
      {/* 顶部行：favicon + 标题（最多 2 行，min-h 保持卡片高度统一） */}
      <div className="flex w-full items-start gap-2.5">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] bg-[var(--muted)]">
          <FaviconImage
            src={site.favicon}
            alt={site.title}
            size={20}
            imageClassName="h-5 w-5 rounded-[2px] flex-shrink-0"
            iconClassName="h-3.5 w-3.5 text-[var(--muted-foreground)]"
          />
        </span>
        <span className="min-w-0 flex-1 line-clamp-2 min-h-[2lh] text-[15px] font-semibold leading-tight text-[var(--foreground)]">
          {site.title}
        </span>
      </div>

      {/* 描述 / 标签 */}
      <div className="flex w-full items-center gap-1.5">
        <SiteTags site={site} />
      </div>
    </a>
  );
}

/** 站点网格：4 列自适应 */
export function StaticBoard({ sites }: StaticBoardProps) {
  if (sites.length === 0) return null;

  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {sites.map((site) => (
        <StaticSiteCard key={site.id} site={site} />
      ))}
    </div>
  );
}
