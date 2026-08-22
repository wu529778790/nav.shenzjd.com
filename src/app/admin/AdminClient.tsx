/**
 * 后台交互组件（M3 全量站点管理）
 *
 * 分页表格：全量站点平铺
 * - 工具栏：搜索（防抖）/ 顶级分类筛选 / 排序（标题/报告数/最新）
 * - 表格：checkbox 多选 + favicon + 标题(链接) + URL + 分类 + 报告数 + 操作
 * - 操作：打开核验 / 编辑（4 字段弹窗）/ 删除 / 批量删除
 * - 分页控件 + 总数
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AdminSiteRow {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  reportCount: number;
  createdAt?: string;
}

export interface SitePage {
  items: AdminSiteRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TopCategory {
  id: string;
  name: string;
  icon?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  state: "登录状态校验失败，请重新登录",
  forbidden: "该 GitHub 账号无权访问后台",
  token: "GitHub 授权失败，请重试",
  network: "网络异常，请重试",
  user: "获取 GitHub 用户信息失败，请重试",
};

/** 轻量 toast（无依赖） */
function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-[var(--neutral-900)] px-4 py-2 text-sm text-white shadow-lg">
      {message}
    </div>
  );
}

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
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          管理全站站点：搜索、编辑、删除
        </p>
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

/** 编辑弹窗 */
function EditModal({
  site,
  onClose,
  onSave,
}: {
  site: AdminSiteRow;
  onClose: () => void;
  onSave: (fields: {
    title: string;
    url: string;
    description: string;
    favicon: string;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(site.title);
  const [url, setUrl] = useState(site.url);
  const [description, setDescription] = useState(site.description ?? "");
  const [favicon, setFavicon] = useState(site.favicon ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || !url.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        url: url.trim(),
        description: description.trim(),
        favicon: favicon.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-[var(--radius-md)] border border-[var(--input-border)] bg-[var(--background-secondary)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--neutral-900)]";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="card w-full max-w-md p-6">
        <h2 className="mb-4 text-lg font-bold text-[var(--foreground)]">编辑站点</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--foreground-secondary)]">
              标题 *
            </label>
            <input
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--foreground-secondary)]">
              URL *
            </label>
            <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--foreground-secondary)]">
              描述
            </label>
            <textarea
              className={`${inputCls} min-h-16 resize-y`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--foreground-secondary)]">
              favicon URL
            </label>
            <input
              className={inputCls}
              value={favicon}
              onChange={(e) => setFavicon(e.target.value)}
              placeholder="留空自动获取"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground-secondary)] hover:bg-[var(--muted)]"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving || !title.trim() || !url.trim()}
            onClick={submit}
            className="cursor-pointer rounded-[var(--radius-md)] bg-[var(--neutral-900)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminClient({
  login,
  initialPage,
  initialCategories,
  error,
}: {
  login: string | null;
  initialPage: SitePage;
  initialCategories: TopCategory[];
  error?: string;
}) {
  const [page, setPage] = useState<SitePage>(initialPage);
  const [categories] = useState<TopCategory[]>(initialCategories);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sort, setSort] = useState<"title" | "reports" | "latest">("title");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<AdminSiteRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };

  const load = useCallback(async (opts: { p?: number; q?: string; cat?: string; s?: string }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(opts.p ?? 1),
        pageSize: "20",
        sort: opts.s ?? "title",
      });
      if (opts.q) params.set("q", opts.q);
      if (opts.cat) params.set("categoryId", opts.cat);
      const res = await fetch(`/api/admin/sites?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as SitePage;
      setPage(data);
      setSelected(new Set());
    } catch {
      showToast("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }, []);

  // 搜索防抖
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      load({ p: 1, q: q.trim(), cat: categoryId, s: sort });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, categoryId, sort, load]);

  if (!login) {
    return <LoginCard error={error} />;
  }

  const totalPages = Math.max(1, Math.ceil(page.total / page.pageSize));
  const allSelected = page.items.length > 0 && page.items.every((s) => selected.has(s.id));

  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) return new Set();
      const next = new Set(prev);
      for (const s of page.items) next.add(s.id);
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteOne = async (site: AdminSiteRow) => {
    if (
      !window.confirm(`确定删除「${site.title}」？\n站点将从导航中移除并清除全部报告，无法恢复。`)
    )
      return;
    try {
      const res = await fetch(`/api/admin/sites/${site.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast("已删除站点");
      load({ p: page.page, q, cat: categoryId, s: sort });
    } catch {
      showToast("删除失败，请稍后重试");
    }
  };

  const deleteBatch = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(`确定删除选中的 ${ids.length} 个站点？\n无法恢复。`)) return;
    try {
      const res = await fetch(`/api/admin/sites?ids=${ids.join(",")}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast(`已删除 ${ids.length} 个站点`);
      load({ p: page.page, q, cat: categoryId, s: sort });
    } catch {
      showToast("批量删除失败，请稍后重试");
    }
  };

  const saveEdit = async (fields: {
    title: string;
    url: string;
    description: string;
    favicon: string;
  }) => {
    if (!editing) return;
    const res = await fetch(`/api/admin/sites/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!res.ok) throw new Error();
    showToast("已保存修改");
    load({ p: page.page, q, cat: categoryId, s: sort });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      {/* 顶部条 */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">后台管理</h1>
          <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
            登录：<span className="font-medium text-[var(--foreground)]">{login}</span>
            <span className="ml-2">
              共 <span className="font-medium tabular-nums">{page.total}</span> 个站点
            </span>
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

      {/* 工具栏 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索标题 / URL / 描述…"
          className="input !w-56 !py-2"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--input-border)] bg-[var(--background-secondary)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--neutral-900)]"
        >
          <option value="">全部分类</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "title" | "reports" | "latest")}
          className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--input-border)] bg-[var(--background-secondary)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--neutral-900)]"
        >
          <option value="title">按标题排序</option>
          <option value="reports">按报告数排序</option>
          <option value="latest">按添加时间排序</option>
        </select>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={deleteBatch}
            className="cursor-pointer rounded-[var(--radius-md)] bg-[var(--error)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            删除选中（{selected.size}）
          </button>
        )}
        <span className="ml-auto text-xs tabular-nums text-[var(--muted-foreground)]">
          {loading ? "加载中…" : `第 ${page.page} / ${totalPages} 页`}
        </span>
      </div>

      {/* 表格 */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs text-[var(--muted-foreground)]">
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="全选"
                />
              </th>
              <th className="px-3 py-2.5 font-medium">标题</th>
              <th className="px-3 py-2.5 font-medium">URL</th>
              <th className="px-3 py-2.5 font-medium">分类</th>
              <th className="px-3 py-2.5 text-center font-medium">报告</th>
              <th className="px-3 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {page.items.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-12 text-center text-sm text-[var(--muted-foreground)]"
                >
                  没有匹配的站点
                </td>
              </tr>
            ) : (
              page.items.map((site) => (
                <tr
                  key={site.id}
                  className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--muted)]/40"
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(site.id)}
                      onChange={() => toggleOne(site.id)}
                      aria-label={`选择 ${site.title}`}
                    />
                  </td>
                  <td className="max-w-[220px] px-3 py-2.5">
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${site.title}\n${site.url}`}
                      className="flex items-center gap-2 font-medium text-[var(--foreground)] hover:text-[var(--accent-500)]"
                    >
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded text-[10px]">
                        {site.favicon ? (
                          // eslint-disable-next-line @next/next/no-img-element -- 后台 favicon 轻量展示
                          <img
                            src={site.favicon}
                            alt=""
                            className="h-5 w-5 object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : null}
                      </span>
                      <span className="truncate">{site.title}</span>
                    </a>
                    {site.description && (
                      <p className="mt-0.5 max-w-[220px] truncate text-xs text-[var(--muted-foreground)]">
                        {site.description}
                      </p>
                    )}
                  </td>
                  <td className="max-w-[240px] px-3 py-2.5">
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-[var(--accent-500)] hover:underline"
                    >
                      {site.url}
                    </a>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--foreground-secondary)]">
                    {site.categoryName ?? "未知"}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {site.reportCount > 0 ? (
                      <span className="rounded-full bg-[var(--error)]/10 px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--error)]">
                        {site.reportCount}
                      </span>
                    ) : (
                      <span className="text-xs tabular-nums text-[var(--muted-foreground)]">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="打开核验"
                        className="rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground-secondary)] hover:bg-[var(--muted)]"
                      >
                        打开 ↗
                      </a>
                      <button
                        type="button"
                        onClick={() => setEditing(site)}
                        className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground-secondary)] hover:bg-[var(--muted)]"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteOne(site)}
                        className="cursor-pointer rounded-[var(--radius-sm)] px-2 py-1 text-xs text-[var(--error)] hover:bg-[var(--error)]/10"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {page.total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-xs text-[var(--muted-foreground)]">
            共 {page.total} 条 · 每页 {page.pageSize} 条
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page.page <= 1}
              onClick={() => load({ p: page.page - 1, q, cat: categoryId, s: sort })}
              className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-[var(--foreground-secondary)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              上一页
            </button>
            <span className="px-2 tabular-nums text-[var(--foreground)]">
              {page.page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page.page >= totalPages}
              onClick={() => load({ p: page.page + 1, q, cat: categoryId, s: sort })}
              className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-[var(--foreground-secondary)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {editing && <EditModal site={editing} onClose={() => setEditing(null)} onSave={saveEdit} />}
      {toast && <Toast message={toast} />}
    </div>
  );
}
