/**
 * 失效标注（匿名报失效）存储层（服务端）
 *
 * 手动模式（用户拍板 2026-08-22）：
 * - 匿名用户对站点点击「报失效」→ 写入 site_dead_reports 表
 * - 页面将已有报告（count ≥ 1）的站点标注为「已失效」（置灰 + chip）
 * - M3 后台据此手动核验并删除失效站点
 *
 * 身份：与 M1 点赞同一套 HttpOnly anon_id cookie（匿名、无登录）。
 * 数据表由 turso.ts 的 ensureTables 幂等自建。
 */

import { getClient, ensureTables } from "@/lib/server/turso";

export interface ReportState {
  reported: boolean;
  count: number;
}

/** 所有站点的报告数 → Map<siteId, count> */
export async function getReportCounts(): Promise<Map<string, number>> {
  await ensureTables();
  const db = getClient();
  const rs = await db.execute(
    "SELECT site_id, COUNT(*) AS c FROM site_dead_reports GROUP BY site_id"
  );
  const map = new Map<string, number>();
  for (const r of rs.rows) {
    map.set(String(r.site_id), Number(r.c));
  }
  return map;
}

/** 某 anon_id 已报失效的 site_id 列表 */
export async function getReportedSiteIds(anonId: string): Promise<string[]> {
  await ensureTables();
  const db = getClient();
  const rs = await db.execute({
    sql: "SELECT site_id FROM site_dead_reports WHERE anon_id = ?",
    args: [anonId],
  });
  return rs.rows.map((r) => String(r.site_id));
}

/** 单站点报告数 */
export async function getReportCount(siteId: string): Promise<number> {
  await ensureTables();
  const db = getClient();
  const rs = await db.execute({
    sql: "SELECT COUNT(*) AS c FROM site_dead_reports WHERE site_id = ?",
    args: [siteId],
  });
  return Number(rs.rows[0]?.c ?? 0);
}

/** 过去 sinceMs 毫秒内该 anon_id 新增的报告数（限流用，只计新增） */
export async function recentReportCount(anonId: string, sinceMs: number): Promise<number> {
  await ensureTables();
  const db = getClient();
  const rs = await db.execute({
    sql: "SELECT COUNT(*) AS c FROM site_dead_reports WHERE anon_id = ? AND created_at >= ?",
    args: [anonId, sinceMs],
  });
  return Number(rs.rows[0]?.c ?? 0);
}

/** 报失效（幂等：已报则返回当前状态） */
export async function addReport(anonId: string, siteId: string): Promise<ReportState> {
  await ensureTables();
  const db = getClient();
  await db.execute({
    sql: "INSERT OR IGNORE INTO site_dead_reports (site_id, anon_id, created_at) VALUES (?, ?, ?)",
    args: [siteId, anonId, Date.now()],
  });
  return { reported: true, count: await getReportCount(siteId) };
}

/** 取消报失效（幂等：未报则返回当前状态） */
export async function removeReport(anonId: string, siteId: string): Promise<ReportState> {
  await ensureTables();
  const db = getClient();
  await db.execute({
    sql: "DELETE FROM site_dead_reports WHERE site_id = ? AND anon_id = ?",
    args: [siteId, anonId],
  });
  return { reported: false, count: await getReportCount(siteId) };
}
