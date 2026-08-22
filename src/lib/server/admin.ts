/**
 * 后台数据层（M3）
 *
 * 失效站点聚合列表 + 删除/清除报告。
 * 表结构由 turso.ts 的 ensureTables 幂等自建（sites / categories / site_dead_reports）。
 */

import { getClient, ensureTables } from "@/lib/server/turso";

/** 失效站点聚合条目（后台列表用） */
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

/** 全部被报失效的站点，按报告数降序、最近报告时间降序 */
export async function getDeadSites(): Promise<DeadSite[]> {
  await ensureTables();
  const db = getClient();
  const rs = await db.execute(`
    SELECT s.id, s.title, s.url, s.favicon, s.description, s.category_id,
           c.name AS category_name,
           COUNT(r.site_id)   AS report_count,
           MAX(r.created_at)  AS last_report_at
    FROM sites s
    JOIN site_dead_reports r ON r.site_id = s.id
    LEFT JOIN categories c   ON c.id = s.category_id
    GROUP BY s.id
    ORDER BY report_count DESC, last_report_at DESC
  `);
  return rs.rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    url: String(r.url),
    favicon: r.favicon != null ? String(r.favicon) : undefined,
    description: r.description != null ? String(r.description) : undefined,
    categoryId: r.category_id != null ? String(r.category_id) : undefined,
    categoryName: r.category_name != null ? String(r.category_name) : undefined,
    reportCount: Number(r.report_count),
    lastReportAt: r.last_report_at != null ? Number(r.last_report_at) : null,
  }));
}

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

/** 删除站点（事务：连带清除全部失效报告） */
export async function deleteSite(siteId: string): Promise<void> {
  await ensureTables();
  const db = getClient();
  await db.batch([
    { sql: "DELETE FROM site_dead_reports WHERE site_id = ?", args: [siteId] },
    { sql: "DELETE FROM sites WHERE id = ?", args: [siteId] },
  ]);
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
