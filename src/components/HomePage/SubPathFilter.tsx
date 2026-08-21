/**
 * 子路径标签筛选（2026-08-21 重构）
 *
 * 从当前分类所有 site 的 description 中提取「子路径」段（" / " 分隔的多级子分类）作为可点击标签，
 * 多选 OR 筛选。解决「一个分类下几十几百条链接，需要快速切到子主题」的场景。
 *
 * 例如「01　影视」分类下，会有「VIP 解析」「美剧」「纪录片」「动漫」等子标签，
 * 用户点击即筛出对应子主题的链接集合。
 */

"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Filter, X } from "lucide-react";
import type { Site } from "@/types";

interface SubPathFilterProps {
  /** 当前分类下的所有 sites（未筛选） */
  sites: Site[];
  /** 选中的子路径标签集合 */
  selected: string[];
  /** 选中状态变更 */
  onChange: (selected: string[]) => void;
  /** 顶部展示数量限制（按频次） */
  topN?: number;
}

/** 从 description 提取子路径段：「01.网页 综合 · 来源: xx · 点击数」→ "01.网页 综合" */
function extractSubPath(description?: string): string {
  if (!description) return "";
  return description.split(" · ")[0]?.trim() ?? "";
}

export function SubPathFilter({
  sites,
  selected,
  onChange,
  topN = 12,
}: SubPathFilterProps) {
  const [expanded, setExpanded] = useState(false);

  // 统计子路径频次 + 排序
  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sites) {
      const tag = extractSubPath(s.description);
      if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    const all = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
    return { top: all.slice(0, topN), total: all.length };
  }, [sites, topN]);

  if (tagOptions.total === 0) return null;

  const toggle = (tag: string) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  };

  const visibleTags = expanded ? tagOptions.top : tagOptions.top;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <Filter className="h-3 w-3" />
        <span>子主题筛选</span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[var(--primary-700)] hover:bg-[var(--primary-600)]/10"
          >
            <X className="h-3 w-3" />
            清除 {selected.length} 个筛选
          </button>
        )}
        {tagOptions.total > topN && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded-full px-2 py-0.5 hover:bg-[var(--muted)]"
          >
            {expanded ? "收起" : `展开 (${tagOptions.total})`}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visibleTags.map(({ tag, count }) => {
          const isSelected = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                isSelected
                  ? "border-[var(--primary-600)] bg-[var(--primary-600)] text-white"
                  : "border-[var(--border)] bg-[var(--muted)]/40 text-[var(--foreground-secondary)] hover:border-[var(--primary-400)] hover:text-[var(--primary-700)]"
              )}
              title={`${tag} (${count})`}
            >
              <span className="max-w-[16rem] truncate">{tag}</span>
              <span
                className={cn(
                  "tabular-nums",
                  isSelected ? "text-white/80" : "text-[var(--muted-foreground)]"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}