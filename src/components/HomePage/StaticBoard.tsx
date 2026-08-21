"use client";

/**
 * 静态站点板 + 失效标注（2026-08-22 M2 手动模式）
 *
 * 站点卡片网格：favicon + 标题 + 描述 + 标签 chip（黄=官方直解 / 灰=备用链接）。
 * 卡片右上角为「报失效」⚑ 按钮（匿名，HttpOnly anon_id cookie）：
 * - 有报告（count ≥ 1）的站点：卡片置灰 + 底部「已失效 · N」chip，⚑ 常显
 * - 点击：乐观更新 → POST/DELETE → 成功以服务端结果覆盖 / 失败回滚 + toast
 * 数据由 SSR 注入（initialReportCounts / initialReportedSiteIds），首屏无闪烁。
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { FaviconImage } from "@/components/FaviconImage";
import type { Site } from "@/types";

interface StaticBoardProps {
  sites: Site[];
  reportCounts?: Record<string, number>;
  reportedSiteIds?: string[];
}

/** 本地覆盖状态：优先于 SSR 注入值（乐观更新用） */
interface ReportOverride {
  reported: boolean;
  count: number;
}

/** 旗帜图标（⚑） */
function FlagIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M5 3v18M5 4h12l-2 4l2 4H5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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

/** 「已失效」chip（count ≥ 1 时展示） */
function DeadChip({ count }: { count: number }) {
  return (
    <span className="inline-flex h-[22px] items-center rounded-[var(--radius-xs)] bg-[var(--error)]/10 px-2 text-[11px] font-medium text-[var(--error)]">
      已失效 · {count}
    </span>
  );
}

/** 单个站点卡片 */
function StaticSiteCard({
  site,
  state,
  onToggleReport,
}: {
  site: Site;
  state: ReportOverride;
  onToggleReport: (site: Site) => void;
}) {
  const hasReports = state.count >= 1;

  return (
    <div className="group relative min-w-0">
      <a
        href={site.url}
        target="_blank"
        rel="noopener noreferrer"
        title={`${site.title}\n${site.url}`}
        className={cn("site-card h-full gap-2.5", hasReports && "opacity-70")}
      >
        {/* 顶部行：favicon + 标题（最多 2 行，min-h 保持卡片高度统一；pr 避让右上角 ⚑ 按钮） */}
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
          <span className="min-w-0 flex-1 line-clamp-2 min-h-[2lh] pr-6 text-[15px] font-semibold leading-tight text-[var(--foreground)]">
            {site.title}
          </span>
        </div>

        {/* 描述 / 标签 / 已失效 chip */}
        <div className="flex w-full items-center gap-1.5">
          <SiteTags site={site} />
          {hasReports && <DeadChip count={state.count} />}
        </div>
      </a>

      {/* 右上角「报失效」按钮（原三点位置，独立 button 避免嵌套 <a>） */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleReport(site);
        }}
        aria-pressed={state.reported}
        title={state.reported ? "取消报失效" : "报失效"}
        className={cn(
          "absolute right-3.5 top-3.5 z-10 flex h-6 cursor-pointer items-center gap-1 rounded-[var(--radius-xs)] px-1.5 text-[11px] tabular-nums transition-colors duration-100",
          state.reported
            ? "bg-[var(--error)]/10 text-[var(--error)]"
            : hasReports
              ? "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              : "text-[var(--muted-foreground)] opacity-0 hover:bg-[var(--muted)] hover:text-[var(--foreground)] group-hover:opacity-100"
        )}
      >
        <FlagIcon filled={state.reported} />
        {hasReports && <span>{state.count}</span>}
      </button>
    </div>
  );
}

/** 站点网格：4 列自适应 + 失效标注 */
export function StaticBoard({
  sites,
  reportCounts = {},
  reportedSiteIds = [],
}: StaticBoardProps) {
  const [overrides, setOverrides] = useState<Map<string, ReportOverride>>(new Map());
  const [toast, setToast] = useState<string | null>(null);

  const reportedSet = new Set(reportedSiteIds);

  const stateFor = (site: Site): ReportOverride => {
    const o = overrides.get(site.id);
    if (o) return o;
    return {
      reported: reportedSet.has(site.id),
      count: reportCounts[site.id] ?? 0,
    };
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };

  const toggleReport = (site: Site) => {
    const cur = stateFor(site);
    const next: ReportOverride = {
      reported: !cur.reported,
      count: cur.count + (cur.reported ? -1 : 1),
    };
    setOverrides((prev) => new Map(prev).set(site.id, next));

    fetch(`/api/sites/${encodeURIComponent(site.id)}/dead-report`, {
      method: cur.reported ? "DELETE" : "POST",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ReportOverride;
        setOverrides((prev) => new Map(prev).set(site.id, data));
      })
      .catch(() => {
        // 失败回滚到点击前状态
        setOverrides((prev) => {
          const m = new Map(prev);
          m.set(site.id, cur);
          return m;
        });
        showToast("操作失败，请稍后重试");
      });
  };

  if (sites.length === 0) return null;

  return (
    <>
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sites.map((site) => (
          <StaticSiteCard
            key={site.id}
            site={site}
            state={stateFor(site)}
            onToggleReport={toggleReport}
          />
        ))}
      </div>

      {/* 轻量 toast（无依赖） */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-[var(--radius-md)] bg-[var(--neutral-900)] px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
