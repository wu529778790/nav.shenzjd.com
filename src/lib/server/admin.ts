/**
 * 后台数据层（M3）
 *
 * 全量站点管理：分页查询 / 搜索 / 分类筛选 / 编辑 / 批量删除 / 清除报告。
 * 表结构由 turso.ts 的 ensureTables 幂等自建（sites / categories / site_dead_reports）。
 */

import { getClient, ensureTables } from "@/lib/server/turso";

/** 站点是否存在 */
export async function siteExists(siteId: string): Promise<boolean> {
  await ensureTables();
  const db = getClient();
  const rs = await db.execute({
    sql: "SELECT id FROM sites WHERE id = ?",
    args: [siteId],
  });
  return rs.rows.length > 0;
}

/** 软删除站点（进垃圾箱）：打 _deleted 墓碑标记，首页自动隐藏 */
export async function deleteSite(siteId: string): Promise<void> {
  await ensureTables();
  const db = getClient();
  await db.execute({
    sql: "UPDATE sites SET _deleted = 1, deleted_at = ? WHERE id = ?",
    args: [String(Date.now()), siteId],
  });
}

/** 只清除该站点的失效报告（站点保留） */
export async function clearSiteReports(siteId: string): Promise<void> {
  await ensureTables();
  const db = getClient();
  await db.execute({
    sql: "DELETE FROM site_dead_reports WHERE site_id = ?",
    args: [siteId],
  });
}

/* ============ 全量站点管理（分页表格，2026-08-22） ============ */

/** 后台表格条目 */
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

export interface SitePageParams {
  page: number; // 1-based
  pageSize: number; // 1-100
  q?: string; // 标题/URL/描述 模糊搜索
  categoryId?: string; // 顶级分类 id（含整棵子树）
  sort?: "reports" | "title" | "latest";
}

export interface SitePage {
  items: AdminSiteRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** 顶级分类列表（筛选下拉用） */
export async function getTopCategories(): Promise<
  Array<{ id: string; name: string; icon?: string }>
> {
  await ensureTables();
  const db = getClient();
  const rs = await db.execute(
    "SELECT id, name, icon FROM categories WHERE parent_id IS NULL ORDER BY sort ASC, name ASC"
  );
  return rs.rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    icon: r.icon != null ? String(r.icon) : undefined,
  }));
}

/** 收集某分类 id 的整棵子树 id（含自身），用于「顶级分类 → 全部子分类站点」筛选 */
export async function getDescendantCategoryIds(rootId: string): Promise<string[]> {
  await ensureTables();
  const db = getClient();
  const rs = await db.execute("SELECT id, parent_id FROM categories");
  const byParent = new Map<string | null, string[]>();
  for (const r of rs.rows) {
    const pid = r.parent_id != null && r.parent_id !== "" ? String(r.parent_id) : null;
    const arr = byParent.get(pid) ?? [];
    arr.push(String(r.id));
    byParent.set(pid, arr);
  }
  const out: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    out.push(id);
    for (const child of byParent.get(id) ?? []) queue.push(child);
  }
  return out;
}

/** 分页查询全量站点（含分类名 + 失效报告数），支持搜索/分类筛选/排序 */
export async function getSitesPage(params: SitePageParams): Promise<SitePage> {
  await ensureTables();
  const db = getClient();
  const { page, pageSize, q, categoryId, sort } = params;
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 20));
  const offset = (safePage - 1) * safeSize;

  // 分类筛选 → 子树 id 集合
  let categoryIds: string[] | null = null;
  if (categoryId) {
    categoryIds = await getDescendantCategoryIds(categoryId);
    if (categoryIds.length === 0)
      return { items: [], total: 0, page: safePage, pageSize: safeSize };
  }

  const where: string[] = [];
  const args: (string | number)[] = [];
  where.push("s._deleted = 0"); // 回收站外的正常站点
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    where.push("(s.title LIKE ? OR s.url LIKE ? OR s.description LIKE ?)");
    args.push(like, like, like);
  }
  if (categoryIds) {
    where.push(`s.category_id IN (${categoryIds.map(() => "?").join(",")})`);
    args.push(...categoryIds);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const orderSql =
    sort === "reports"
      ? "ORDER BY report_count DESC, s.title ASC"
      : sort === "latest"
        ? "ORDER BY s.created_at DESC, s.title ASC"
        : "ORDER BY s.title ASC";

  const [countRs, listRs] = await db.batch([
    { sql: `SELECT COUNT(*) AS n FROM sites s ${whereSql}`, args },
    {
      sql: `SELECT s.id, s.title, s.url, s.favicon, s.description, s.category_id,
                   c.name AS category_name, s.created_at,
                   COUNT(r.site_id) AS report_count
            FROM sites s
            LEFT JOIN categories c        ON c.id = s.category_id
            LEFT JOIN site_dead_reports r ON r.site_id = s.id
            ${whereSql}
            GROUP BY s.id
            ${orderSql}
            LIMIT ? OFFSET ?`,
      args: [...args, safeSize, offset],
    },
  ]);

  const total = Number(countRs.rows[0]?.n ?? 0);
  const items: AdminSiteRow[] = listRs.rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    url: String(r.url),
    favicon: r.favicon != null ? String(r.favicon) : undefined,
    description: r.description != null ? String(r.description) : undefined,
    categoryId: r.category_id != null ? String(r.category_id) : undefined,
    categoryName: r.category_name != null ? String(r.category_name) : undefined,
    reportCount: Number(r.report_count),
    createdAt: r.created_at != null ? String(r.created_at) : undefined,
  }));

  return { items, total, page: safePage, pageSize: safeSize };
}

export interface SiteUpdateFields {
  title?: string;
  url?: string;
  description?: string | null;
  favicon?: string | null;
}

/** 更新站点信息（只更新提供的字段，null 表示清空可空字段） */
export async function updateSite(siteId: string, fields: SiteUpdateFields): Promise<void> {
  await ensureTables();
  const db = getClient();
  const sets: string[] = [];
  const args: (string | null)[] = [];
  if (fields.title !== undefined) {
    sets.push("title = ?");
    args.push(fields.title);
  }
  if (fields.url !== undefined) {
    sets.push("url = ?");
    args.push(fields.url);
  }
  if (fields.description !== undefined) {
    sets.push("description = ?");
    args.push(fields.description ?? null);
  }
  if (fields.favicon !== undefined) {
    sets.push("favicon = ?");
    args.push(fields.favicon ?? null);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  args.push(String(Date.now()));
  args.push(siteId);
  await db.execute({
    sql: `UPDATE sites SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
}

/** 批量软删除站点（进垃圾箱） */
export async function deleteSites(siteIds: string[]): Promise<void> {
  if (siteIds.length === 0) return;
  await ensureTables();
  const db = getClient();
  const placeholders = siteIds.map(() => "?").join(",");
  await db.execute({
    sql: `UPDATE sites SET _deleted = 1, deleted_at = ? WHERE id IN (${placeholders})`,
    args: [String(Date.now()), ...siteIds],
  });
}

/* ============ 垃圾箱（回收站） ============ */

/** 垃圾箱条目 */
export interface TrashSite {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  deletedAt: number | null;
}

/** 垃圾箱列表（软删除的站点），按删除时间倒序 */
export async function getTrashSites(): Promise<TrashSite[]> {
  await ensureTables();
  const db = getClient();
  const rs = await db.execute(`
    SELECT s.id, s.title, s.url, s.favicon, s.description, s.category_id, s.deleted_at,
           c.name AS category_name
    FROM sites s
    LEFT JOIN categories c ON c.id = s.category_id
    WHERE s._deleted = 1
    ORDER BY s.deleted_at DESC, s.title ASC
  `);
  return rs.rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    url: String(r.url),
    favicon: r.favicon != null ? String(r.favicon) : undefined,
    description: r.description != null ? String(r.description) : undefined,
    categoryId: r.category_id != null ? String(r.category_id) : undefined,
    categoryName: r.category_name != null ? String(r.category_name) : undefined,
    deletedAt: r.deleted_at != null ? Number(r.deleted_at) : null,
  }));
}

/** 恢复站点（单条/批量）：清除墓碑标记 */
export async function restoreSites(siteIds: string[]): Promise<void> {
  if (siteIds.length === 0) return;
  await ensureTables();
  const db = getClient();
  const placeholders = siteIds.map(() => "?").join(",");
  await db.execute({
    sql: `UPDATE sites SET _deleted = 0, deleted_at = NULL WHERE id IN (${placeholders})`,
    args: siteIds,
  });
}

/** 永久删除站点（单条/批量，事务：连带清除失效报告） */
export async function purgeSites(siteIds: string[]): Promise<void> {
  if (siteIds.length === 0) return;
  await ensureTables();
  const db = getClient();
  const placeholders = siteIds.map(() => "?").join(",");
  await db.batch([
    {
      sql: `DELETE FROM site_dead_reports WHERE site_id IN (${placeholders})`,
      args: siteIds,
    },
    {
      sql: `DELETE FROM sites WHERE id IN (${placeholders})`,
      args: siteIds,
    },
  ]);
}
