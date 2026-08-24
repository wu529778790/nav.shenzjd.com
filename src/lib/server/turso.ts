/**
 * Turso (libsql) 存储层（服务端）
 *
 * 规范化多表存储（树形结构，2026-08-21 扩展）：
 * - categories：分类表（parent_id 自引用 → 支持任意深度树）
 * - sites：站点表（外键 category_id，挂在叶子/任意节点）
 * - nav_meta：版本元数据（version / lastModified / _version）
 *
 * 数据由 navdata 工具链（爬虫 + 导入脚本）维护，前端纯只读。
 * 写入策略：事务内全量快照（DELETE + INSERT），与导入脚本语义一致。
 */

import { createClient, type Client } from "@libsql/client";
import { cacheGetOrLoad, cacheInvalidate } from "@/lib/server/cache";
import type { NavData, Category, Site } from "@/types";

let client: Client | null = null;

/** 导航数据缓存键 */
const NAV_CACHE_KEY = "nav:data";

/**
 * 导航数据缓存 TTL（秒，默认 21600 = 6 小时）。
 * 数据基本不改动；独立进程导入脚本改库后靠它兜底，或重启容器立即生效。
 */
const NAV_CACHE_TTL_MS = (Number(process.env.NAV_CACHE_TTL_SECONDS) || 21600) * 1000;

/** 后台/写入方改库后主动失效导航缓存（首页下一次访问立即拿到新数据） */
export function invalidateNavCache(): void {
  cacheInvalidate(NAV_CACHE_KEY);
}

/** 导出给其它服务端模块（如 reports.ts）复用同一 client */
export function getClient(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("缺少 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 环境变量");
  }
  client = createClient({ url, authToken });
  return client;
}

const CREATE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    name TEXT NOT NULL,
    icon TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    _deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    favicon TEXT,
    description TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    _deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    updated_at TEXT,
    created_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS nav_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS site_dead_reports (
    site_id TEXT NOT NULL,
    anon_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(site_id, anon_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sites_category ON sites(category_id)`,
  `CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_site_dead_reports_site ON site_dead_reports(site_id)`,
  `CREATE INDEX IF NOT EXISTS idx_site_dead_reports_anon ON site_dead_reports(anon_id)`,
];

let tablesReady: Promise<void> | null = null;

/** 幂等建表（首次调用后缓存），供 reports.ts 等模块调用 */
export async function ensureTables(): Promise<void> {
  if (!tablesReady) {
    const db = getClient();
    tablesReady = (async () => {
      for (const sql of CREATE_TABLES) {
        await db.execute(sql);
      }
    })();
  }
  await tablesReady;
}

/** 布尔值 → 0/1 */
function boolToInt(value: boolean | undefined): number {
  return value ? 1 : 0;
}

/** null 占位：libsql 参数化用 null 而非 undefined */
function nullable(value: string | undefined | null): string | null {
  return value ?? null;
}

/** 单条 Category 的 INSERT 语句参数 */
function categoryInsert(cat: Category): { sql: string; args: (string | number | null)[] } {
  return {
    sql: `INSERT INTO categories (id, parent_id, name, icon, sort, _deleted, deleted_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      cat.id,
      nullable(cat.parentId),
      cat.name,
      nullable(cat.icon),
      cat.sort ?? 0,
      boolToInt(cat._deleted),
      nullable(cat.deletedAt),
      nullable(cat.updatedAt),
    ],
  };
}

/** 单条 Site 的 INSERT 语句参数 */
function siteInsert(
  categoryId: string,
  site: Site
): { sql: string; args: (string | number | null)[] } {
  return {
    sql: `INSERT INTO sites (id, category_id, title, url, favicon, description, sort,
                            _deleted, deleted_at, updated_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      site.id,
      categoryId,
      site.title,
      site.url,
      nullable(site.favicon),
      nullable(site.description),
      site.sort ?? 0,
      boolToInt(site._deleted),
      nullable(site.deletedAt),
      nullable(site.updatedAt),
      nullable(site.createdAt),
    ],
  };
}

/** 元数据 UPSERT 语句参数 */
function metaUpsert(
  key: string,
  value: string | number
): { sql: string; args: (string | number)[] } {
  return {
    sql: `INSERT INTO nav_meta (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [key, String(value)],
  };
}

/** 递归展平 Category 树 → 扁平数组（含 parentId） */
function flattenCategories(categories: Category[]): Category[] {
  const out: Category[] = [];
  const walk = (cats: Category[], parentId: string | undefined) => {
    for (const c of cats) {
      const { children, ...rest } = c;
      out.push({ ...rest, parentId });
      if (children && children.length > 0) {
        walk(children, c.id);
      }
    }
  };
  walk(categories, undefined);
  return out;
}

/**
 * 读取整份导航数据（树形）。
 * 空库（无任何分类且无 meta）返回 null。
 *
 * 走进程内 TTL 缓存（见 src/lib/server/cache.ts）：
 * - 命中缓存 → 零数据库读（导航数据静态、低频更新，读取量最大的路径）；
 * - 过期后单飞重建（并发只触发一次真实读库，防击穿）；
 * - writeNavData / 后台管理写库后主动失效，改动立即可见。
 */
export async function readNavData(): Promise<NavData | null> {
  return cacheGetOrLoad(NAV_CACHE_KEY, readNavDataUncached, NAV_CACHE_TTL_MS);
}

async function readNavDataUncached(): Promise<NavData | null> {
  await ensureTables();
  const db = getClient();

  const [metaRs, catsRs, sitesRs] = await db.batch([
    "SELECT key, value FROM nav_meta",
    "SELECT * FROM categories ORDER BY sort ASC, id ASC",
    "SELECT * FROM sites ORDER BY sort ASC, id ASC",
  ]);

  const meta: Record<string, string> = {};
  for (const row of metaRs.rows) {
    meta[String(row.key)] = String(row.value);
  }

  const categories: Category[] = catsRs.rows.map((r) => ({
    id: String(r.id),
    parentId: r.parent_id != null && r.parent_id !== "" ? String(r.parent_id) : undefined,
    name: String(r.name),
    icon: r.icon != null ? String(r.icon) : undefined,
    sort: Number(r.sort ?? 0),
    sites: [],
    _deleted: Boolean(r._deleted),
    deletedAt: r.deleted_at != null ? String(r.deleted_at) : undefined,
    updatedAt: r.updated_at != null ? String(r.updated_at) : undefined,
  }));

  const sitesByCategory: Record<string, Site[]> = {};
  for (const r of sitesRs.rows) {
    const site: Site = {
      id: String(r.id),
      title: String(r.title),
      url: String(r.url),
      favicon: r.favicon != null ? String(r.favicon) : undefined,
      description: r.description != null ? String(r.description) : undefined,
      sort: Number(r.sort ?? 0),
      _deleted: Boolean(r._deleted),
      deletedAt: r.deleted_at != null ? String(r.deleted_at) : undefined,
      updatedAt: r.updated_at != null ? String(r.updated_at) : undefined,
      createdAt: r.created_at != null ? String(r.created_at) : undefined,
    };
    const cid = String(r.category_id);
    (sitesByCategory[cid] ??= []).push(site);
  }
  for (const cat of categories) {
    cat.sites = sitesByCategory[cat.id] ?? [];
  }

  if (categories.length === 0 && !meta.version) {
    return null;
  }

  // 按 parentId 组装树
  const byId = new Map<string, Category>();
  for (const c of categories) {
    byId.set(c.id, c);
  }
  const roots: Category[] = [];
  for (const c of categories) {
    if (c.parentId && byId.has(c.parentId)) {
      const parent = byId.get(c.parentId)!;
      (parent.children ??= []).push(c);
    } else {
      roots.push(c);
    }
  }
  // 每层的 children 按 sort 排序
  const sortChildren = (cats: Category[]) => {
    cats.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "zh-CN"));
    for (const c of cats) {
      if (c.children) sortChildren(c.children);
    }
  };
  sortChildren(roots);

  return {
    version: meta.version ?? "1.0",
    lastModified: meta.lastModified ? Number(meta.lastModified) : 0,
    _version: meta._version ? Number(meta._version) : undefined,
    categories: roots,
  };
}

/**
 * 整份写入（事务内全量快照）。
 * 接受树形 NavData，内部递归展平为带 parent_id 的行。
 * 写成功后主动失效导航缓存，保证首页下一次访问读到新数据。
 */
export async function writeNavData(data: NavData): Promise<void> {
  await ensureTables();
  const db = getClient();

  const statements: ({ sql: string; args: (string | number | null)[] } | string)[] = [
    "DELETE FROM sites",
    "DELETE FROM categories",
  ];

  const flat = flattenCategories(data.categories);
  for (const cat of flat) {
    statements.push(categoryInsert(cat));
    for (const site of cat.sites) {
      statements.push(siteInsert(cat.id, site));
    }
  }

  statements.push(metaUpsert("version", data.version));
  statements.push(metaUpsert("lastModified", data.lastModified ?? 0));
  if (data._version != null) {
    statements.push(metaUpsert("_version", data._version));
  }

  await db.batch(statements);
  invalidateNavCache();
}
