/**
 * 墓碑（tombstone）工具
 *
 * 删除时不从数据里移除条目，而是打 `_deleted` 标记，从而让删除事实能像普通改动一样
 * 通过字段级合并跨设备传播（详见 src/lib/storage/merge.ts）。
 *
 * 这里只负责两件事：
 * 1. isDeleted —— 判断某条目是否已删除；
 * 2. visibleCategories / visibleSites —— 渲染前把墓碑条目过滤掉，用户肉眼看不到。
 */

import type { Category, Site } from "@/types";

export function isDeleted(
  item: { _deleted?: boolean } | null | undefined
): boolean {
  return Boolean(item && item._deleted);
}

export function visibleSites(sites: Site[]): Site[] {
  return sites.filter((s) => !isDeleted(s));
}

export function visibleCategories(categories: Category[]): Category[] {
  return categories
    .filter((c) => !isDeleted(c))
    .map((c) => ({ ...c, sites: visibleSites(c.sites) }));
}
