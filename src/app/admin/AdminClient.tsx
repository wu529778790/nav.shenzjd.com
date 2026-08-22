/**
 * 后台交互组件（M3）
 *
 * - 未登录：GitHub 登录卡片 + OAuth 错误提示
 * - 已登录：失效站点聚合列表（标题/URL/分类/报告数/最近时间）
 *   操作：打开核验（新标签直达）/ 清除报告 / 删除站点（confirm 二次确认）
 */

"use client";

import { useState } from "react";

export interface DeadSite {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  reportCount: number;
  lastReportAt: number | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  state: "登录状态校验失败，请重新登录",
  forbidden: "该 GitHub 账号无权访问后台",
  token: "GitHub 授权失败，请重试",
  network: "网络异常，请重试",
  user: "获取 GitHub 用户信息失败，请重试",
};

/** unix ms → 本地时间字符串 */
function formatTime(ts: number | null): string {
  if (!ts) return "-";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 轻量 toast（无依赖，沿用 M2 模式） */
function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-[var(--neutral-900)] px-4 py-2 text-sm text-white shadow-lg">
      {message}
    </div>
  );
}

/** GitHub 图标（官方 mark，单色） */
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="20"
      height="20"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function LoginCard({ error }: { error?: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md items-center justify-center px-4">
      <div className="card w-full p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--neutral-900)] text-white">
          <GitHubIcon className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">后台管理</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">核验并删除被报告失效的站点</p>
        {error && (
          <p className="mt-3 rounded-[var(--radius-md)] bg-[var(--error)]/10 px-3 py-2 text-sm text-[var(--error)]">
            {ERROR_MESSAGES[error] ?? "登录失败，请重试"}
          </p>
        )}
        <a
          href="/api/auth/github"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--neutral-900)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <GitHubIcon className="h-4 w-4" />
          使用 GitHub 登录
        </a>
      </div>
    </div>
  );
}

export default function AdminClient({
  login,
  initialSites,
  error,
}: {
  login: string | null;
  initialSites: DeadSite[];
  error?: string;
}) {
  const [sites, setSites] = useState<DeadSite[]>(initialSites);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };

  if (!login) {
    return <LoginCard error={error} />;
  }

  const runAction = async (
    site: DeadSite,
    url: string,
    confirmText: string,
    successMsg: string
  ) => {
    if (!window.confirm(confirmText)) return;
    setPending((prev) => new Set(prev).add(site.id));
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setSites((prev) => prev.filter((s) => s.id !== site.id));
      showToast(successMsg);
    } catch {
      showToast("操作失败，请稍后重试");
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(site.id);
        return next;
      });
    }
  };

  const totalReports = sites.reduce((sum, s) => sum + s.reportCount, 0);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
      {/* 顶部条 */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">后台管理</h1>
          <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
            登录：<span className="font-medium text-[var(--foreground)]">{login}</span>
            {sites.length > 0 && (
              <span className="ml-2">
                共 <span className="font-medium tabular-nums">{sites.length}</span> 个失效站点 ·{" "}
                <span className="font-medium tabular-nums">{totalReports}</span> 条报告
              </span>
            )}
          </p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--muted)]"
          >
            登出
          </button>
        </form>
      </div>

      {/* 列表 */}
      {sites.length === 0 ? (
        <div className="empty-state">
          <div className="mb-3 text-3xl">🎉</div>
          <div className="text-lg font-semibold">没有失效站点</div>
          <div className="mt-1 text-sm text-[var(--muted-foreground)]">暂无用户报告的失效站点</div>
        </div>
      ) : (
        <ul className="space-y-3">
          {sites.map((site) => (
            <li key={site.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--foreground)]">{site.title}</span>
                    <span className="rounded-full bg-[var(--error)]/10 px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--error)]">
                      {site.reportCount} 次报告
                    </span>
                  </div>
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block truncate text-sm text-[var(--accent-500)] hover:underline"
                  >
                    {site.url}
                  </a>
                  {site.description && (
                    <p className="mt-1 line-clamp-1 text-[13px] text-[var(--muted-foreground)]">
                      {site.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    所属分类：
                    <span className="text-[var(--foreground-secondary)]">
                      {site.categoryName ?? "未知"}
                    </span>
                    <span className="mx-1.5">·</span>
                    最近报告：<span className="tabular-nums">{formatTime(site.lastReportAt)}</span>
                  </p>
                </div>

                {/* 操作 */}
                <div className="flex flex-shrink-0 items-center gap-2">
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--muted)]"
                  >
                    打开核验 ↗
                  </a>
                  <button
                    type="button"
                    disabled={pending.has(site.id)}
                    onClick={() =>
                      runAction(
                        site,
                        `/api/admin/sites/${site.id}/reports`,
                        `确定清除「${site.title}」的失效报告？\n站点本身不会被删除。`,
                        "已清除报告"
                      )
                    }
                    className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    清除报告
                  </button>
                  <button
                    type="button"
                    disabled={pending.has(site.id)}
                    onClick={() =>
                      runAction(
                        site,
                        `/api/admin/sites/${site.id}`,
                        `确定删除「${site.title}」？\n站点将从导航中移除并清除全部报告，无法恢复。`,
                        "已删除站点"
                      )
                    }
                    className="cursor-pointer rounded-[var(--radius-md)] bg-[var(--error)] px-2.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    删除站点
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
