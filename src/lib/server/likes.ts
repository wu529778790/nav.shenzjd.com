/**
 * 点赞存储层（服务端）
 *
 * 与报失效（reports.ts）同构，复用同一套匿名 anon_id 机制：
 * - 匿名用户对站点点击「点赞」→ 写入 site_likes 表
 * - 页面展示点赞数，点赞量高者未来在同分类内排序靠前
 * - 报失效站点排序靠后（排序逻辑由导入脚本/后端处理，本层只负责计数）
 *
 * 数据表由 turso.ts 的 ensureTables 幂等自建。
 */

import { ensureTables } from "@/lib/server/turso";
import { getClient } from "@/lib/server/turso";
import { cacheGetOrLoad, cacheInvalidate } from "@/lib/server/cache";

export interface LikeState {
  liked: boolean;
  count: number;
}

/** 全站点赞数缓存：TTL 兜底（1 小时），点赞/取消都会主动失效 */
const LIKE_COUNTS_KEY = "likes:counts";
const LIKE_COUNTS_TTL_MS = 60 * 60 * 1000;

/** 某 anon_id 的已赞列表缓存：30s 兜底，写后主动失效 */
const LIKED_IDS_TTL_MS = 30 * 1000;

/** 点赞数变更方（addLike / removeLike）写库后主动失效 */
export function invalidateLikeCountsCache(): void {
  cacheInvalidate(LIKE_COUNTS_KEY);
}

/**
 * 所有站点的点赞数 → Map<siteId, count>
 * 走进程内 TTL 缓存（聚合查询是全表 GROUP BY，首页每次访问都会打）。
 */
export async function getLikeCounts(): Promise<Map<string, number>> {
  return cacheGetOrLoad(LIKE_COUNTS_KEY, getLikeCountsUncached, LIKE_COUNTS_TTL_MS);
}

async function getLikeCountsUncached(): Promise<Map<string, number>> {
  await ensureTables();
  const db = getClient();
  const rs = await db.execute(
    "SELECT site_id, COUNT(*) AS c FROM site_likes GROUP BY site_id"
  );
  const map = new Map<string, number>();
  for (const r of rs.rows) {
    map.set(String(r.site_id), Number(r.c));
  }
  return map;
}

/** 某 anon_id 已点赞的 site_id 列表（按 anonId 维度缓存 30s，避免短时间重复打 DB） */
export async function getLikedSiteIds(anonId: string): Promise<string[]> {
  const key = `likes:ids:${anonId}`;
  return cacheGetOrLoad(
    key,
    async () => {
      await ensureTables();
      const db = getClient();
      const rs = await db.execute({
        sql: "SELECT site_id FROM site_likes WHERE anon_id = ?",
        args: [anonId],
      });
      return rs.rows.map((r) => String(r.site_id));
    },
    LIKED_IDS_TTL_MS
  );
}

/** 单站点点赞数 */
export async function getLikeCount(siteId: string): Promise<number> {
  await ensureTables();
  const db = getClient();
  const rs = await db.execute({
    sql: "SELECT COUNT(*) AS c FROM site_likes WHERE site_id = ?",
    args: [siteId],
  });
  return Number(rs.rows[0]?.c ?? 0);
}

/** 过去 sinceMs 毫秒内该 anon_id 新增的点赞数（限流用，只计新增） */
export async function recentLikeCount(anonId: string, sinceMs: number): Promise<number> {
  await ensureTables();
  const db = getClient();
  const rs = await db.execute({
    sql: "SELECT COUNT(*) AS c FROM site_likes WHERE anon_id = ? AND created_at >= ?",
    args: [anonId, sinceMs],
  });
  return Number(rs.rows[0]?.c ?? 0);
}

/** 点赞（幂等：已赞则返回当前状态）。写库后主动失效点赞数缓存。 */
export async function addLike(anonId: string, siteId: string): Promise<LikeState> {
  await ensureTables();
  const db = getClient();
  await db.execute({
    sql: "INSERT OR IGNORE INTO site_likes (site_id, anon_id, created_at) VALUES (?, ?, ?)",
    args: [siteId, anonId, Date.now()],
  });
  invalidateLikeCountsCache();
  cacheInvalidate(`likes:ids:${anonId}`);
  return { liked: true, count: await getLikeCount(siteId) };
}

/** 取消点赞（幂等：未赞则返回当前状态）。写库后主动失效点赞数缓存。 */
export async function removeLike(anonId: string, siteId: string): Promise<LikeState> {
  await ensureTables();
  const db = getClient();
  await db.execute({
    sql: "DELETE FROM site_likes WHERE site_id = ? AND anon_id = ?",
    args: [siteId, anonId],
  });
  invalidateLikeCountsCache();
  cacheInvalidate(`likes:ids:${anonId}`);
  return { liked: false, count: await getLikeCount(siteId) };
}
