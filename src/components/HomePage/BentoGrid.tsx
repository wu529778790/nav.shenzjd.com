"use client";

/**
 * 子分类文件夹网格（2026-08-22 统一规格）
 *
 * 所有子分类以等大的文件夹卡片呈现，避免 Bento 大小交错导致的不统一。
 * 整卡可点击 → 链接到 /c/[id] 分类页（2026-08-24：由 button 改为 Link，可被爬虫抓取）。
 */

import Link from "next/link";
import { FaviconImage } from "@/components/FaviconImage";
import type { Category, Site } from "@/types";

/** 统计节点下挂站点总数（含子孙） */
function countDescendantSites(node: Category): number {
  let n = node.sites.length;
  for (const c of node.children ?? []) n += countDescendantSites(c);
  return n;
}

/** 取前几个站点用于预览 */
function previewSites(node: Category): Site[] {
  const out: Site[] = [...node.sites];
  for (const c of node.children ?? []) {
    if (out.length >= 3) break;
    out.push(...c.sites.slice(0, 3 - out.length));
  }
  return out.slice(0, 3);
}

/** 统一文件夹卡片（整卡链接到分类页 /c/[id]） */
function FolderCard({ node }: { node: Category }) {
  const count = countDescendantSites(node);
  const previews = previewSites(node);

  return (
    <Link
      href={`/c/${node.id}`}
      className="card group flex min-w-0 flex-col gap-3 p-5 text-left transition-colors duration-100 hover:border-[var(--accent-500)]"
    >
      {/* 顶行：文件夹图标 + 标题 + 计数 */}
      <div className="flex w-full items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0 text-[var(--accent-500)]"
            aria-hidden
          >
            <path
              d="M3 6.5C3 5.67 3.67 5 4.5 5H9.5L11.5 7H19.5C20.33 7 21 7.67 21 8.5V17.5C21 18.33 20.33 19 19.5 19H4.5C3.67 19 3 18.33 3 17.5V6.5Z"
              fill="currentColor"
            />
          </svg>
          <span className="truncate text-[16px] font-semibold leading-tight text-[var(--foreground)]">
            {node.name}
          </span>
        </span>
        <span className="flex-shrink-0 text-[13px] text-[var(--muted-foreground)]">
          {count} 个网站
        </span>
      </div>

      {/* 站点预览 chips（最多 3 个，统一高度） */}
      {previews.length > 0 && (
        <div className="flex w-full flex-wrap items-center gap-2">
          {previews.map((site) => (
            <span
              key={site.id}
              className="flex h-8 min-w-0 max-w-[200px] items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--muted)] px-2.5"
              title={site.title}
            >
              <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center overflow-hidden rounded-[2px] bg-[var(--background-secondary)]">
                <FaviconImage
                  src={site.favicon}
                  alt={site.title}
                  size={12}
                  imageClassName="h-3 w-3"
                  iconClassName="h-2.5 w-2.5 text-[var(--muted-foreground)]"
                />
              </span>
              <span className="truncate text-xs text-[var(--foreground-secondary)]">
                {site.title}
              </span>
            </span>
          ))}
          {count > previews.length && (
            <span className="text-xs text-[var(--muted-foreground)]">
              +{count - previews.length}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

/**
 * 子分类网格：统一等大的文件夹卡片。
 * 响应式：移动端 1 列、平板 2 列、桌面 3 列。
 */
export function BentoSubCategoryGrid({ nodes }: { nodes: Category[] }) {
  if (nodes.length === 0) return null;

  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {nodes.map((node) => (
        <FolderCard key={node.id} node={node} />
      ))}
    </div>
  );
}
