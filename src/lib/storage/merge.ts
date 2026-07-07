/**
 * 字段级合并（field-level merge）
 *
 * 用于「pull-before-push」同步：把本地与远端数据按 id 求并集，
 * 取代原先「整文件比较 → 冲突即死锁」的逻辑。
 *
 * 设计目标：
 * 1. 多设备各自新增不同站点 / 分类 → 自动合并，不再误判冲突。
 * 2. 不删除任何一方存在的项 → 杜绝「静默覆盖 / 冲突死锁」导致的数据丢失。
 * 3. 同一 site.id 两端都改过 → last-writer-wins（按 updatedAt），并记录 overlap 供上层提示。
 * 4. 删除用墓碑（_deleted）表达，合并时删除胜出 → 删除可跨设备传播，不再被「后来的编辑」覆盖。
 */

import type { Category, NavData, Site } from "@/types";
import { isDeleted } from "@/lib/utils/tombstone";

export interface MergeResult {
  /** 合并后的完整数据，可同时写回本地与远端 */
  merged: NavData;
  /** 两端都改过且内容不同的 site 标识（categoryId/siteId），供上层提示用 */
  overlaps: string[];
}

/** 按 updatedAt 选较新的一方；缺失时偏向有值的一方；都缺 / 相等则偏向 remote */
function pickWinnerSite(local: Site, remote: Site): Site {
  const lt = local.updatedAt ? Date.parse(local.updatedAt) : NaN;
  const rt = remote.updatedAt ? Date.parse(remote.updatedAt) : NaN;
  if (!Number.isNaN(lt) && !Number.isNaN(rt)) return lt >= rt ? local : remote;
  if (!Number.isNaN(lt)) return local;
  if (!Number.isNaN(rt)) return remote;
  return remote;
}

/**
 * 判断两端站点「用户可见内容」是否相同。
 * 排除 updatedAt：它是挑选胜者的元数据，不应参与「是否冲突」的判定，
 * 否则仅时间戳不同（如两端各打开过一次编辑框）也会被误报为冲突。
 */
function siteContentEqual(a: Site, b: Site): boolean {
  const withoutMeta = (s: Site) =>
    JSON.stringify(
      Object.fromEntries(Object.entries(s).filter(([k]) => k !== "updatedAt")),
    );
  return withoutMeta(a) === withoutMeta(b);
}

function bySort(a: { sort?: number }, b: { sort?: number }): number {
  return (a.sort ?? 0) - (b.sort ?? 0);
}

/**
 * 合并本地与远端导航数据。
 * @param local  当前本地（待写入）的数据
 * @param remote 刚从 GitHub 拉取的远端数据
 */
export function mergeNavData(local: NavData, remote: NavData): MergeResult {
  const overlaps: string[] = [];
  const order: string[] = [];
  const catMap = new Map<string, Category>();

  // 1. 建立分类基底：本地优先，再补远端独有的分类（保留出现顺序）
  const ensureCategory = (cat: Category) => {
    if (!catMap.has(cat.id)) {
      catMap.set(cat.id, { ...cat, sites: [...cat.sites] });
      order.push(cat.id);
    }
  };
  local.categories.forEach(ensureCategory);
  remote.categories.forEach(ensureCategory);

  // 2. 叠加远端站点：以本地站点为基底，远端新增并入，同 id 冲突按 updatedAt 取较新
  for (const rcat of remote.categories) {
    const target = catMap.get(rcat.id);
    if (!target) continue;

    const siteMap = new Map<string, Site>();
    for (const s of target.sites) siteMap.set(s.id, s);

    for (const rs of rcat.sites) {
      const existing = siteMap.get(rs.id);
      if (!existing) {
        siteMap.set(rs.id, rs);
        continue;
      }
      const localDeleted = isDeleted(existing);
      const remoteDeleted = isDeleted(rs);
      if (localDeleted || remoteDeleted) {
        // 墓碑胜出：任一侧打了删除标记，合并结果即删除（取较新的 deletedAt）
        const winner = localDeleted ? existing : rs;
        const deletedAt = [existing.deletedAt, rs.deletedAt]
          .filter(Boolean)
          .sort()
          .slice(-1)[0];
        siteMap.set(rs.id, { ...winner, _deleted: true, deletedAt });
        overlaps.push(`${rcat.id}/${rs.id}`);
      } else if (!siteContentEqual(existing, rs)) {
        // 同 id 且用户可见内容两端不同 → 记为 overlap，并按 updatedAt 取较新一方
        overlaps.push(`${rcat.id}/${rs.id}`);
        siteMap.set(rs.id, pickWinnerSite(existing, rs));
      } else {
        siteMap.set(rs.id, existing);
      }
    }

    target.sites = Array.from(siteMap.values()).sort(bySort);
    // 分类级墓碑：任一侧删除 → 合并结果删除（取较新的 deletedAt）
    const localCat = local.categories.find((c) => c.id === rcat.id);
    if (isDeleted(localCat) || isDeleted(rcat)) {
      const deletedAt = [localCat?.deletedAt, rcat.deletedAt]
        .filter(Boolean)
        .sort()
        .slice(-1)[0];
      target._deleted = true;
      target.deletedAt = deletedAt;
    }
    // 分类元信息以远端为准（若提供），否则保留本地
    if (rcat.name) target.name = rcat.name;
    if (rcat.icon) target.icon = rcat.icon;
    target.sort = rcat.sort ?? target.sort;
  }

  const categories = order.map((id) => catMap.get(id)!).sort(bySort);
  const lastModified = Math.max(local.lastModified || 0, remote.lastModified || 0);

  return {
    merged: {
      version: local.version || remote.version || "1.0",
      lastModified,
      categories,
    },
    overlaps,
  };
}
