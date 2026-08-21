/**
 * Turso (libsql) 存储层（服务端）
 *
 * 规范化多表存储：
 * - categories：分类表
 * - sites：站点表（外键 category_id）
 * - nav_meta：版本元数据（version / lastModified / _version）
 *
 * 写入策略：事务内全量快照（DELETE + INSERT）。
 * 与前端「整份 NavData push」模型天然一致（merge 已在客户端完成），
 * 事务保证原子性；个人数据量（几百条）下毫秒级完成。
 * 墓碑行（_deleted）一并落库，删除仍可跨设备传播，渲染时由前端过滤。
 */

import { createClient, type Client } from "@libsql/client";
import type { NavData, Category, Site } from "@/types";

let client: Client | null = null;

function getClient(): Client {
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
  `CREATE INDEX IF NOT EXISTS idx_sites_category ON sites(category_id)`,
];

let tablesReady: Promise<void> | null = null;

async function ensureTables(): Promise<void> {
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
    sql: `INSERT INTO categories (id, name, icon, sort, _deleted, deleted_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      cat.id,
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
function siteInsert(categoryId: string, site: Site): { sql: string; args: (string | number | null)[] } {
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
function metaUpsert(key: string, value: string | number): { sql: string; args: (string | number)[] } {
  return {
    sql: `INSERT INTO nav_meta (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [key, String(value)],
  };
}

/**
 * 读取整份导航数据。
 * 空库（无任何分类且无 meta）返回 null，语义与旧 GitHub 存储一致。
 */
export async function readNavData(): Promise<NavData | null> {
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

  return {
    version: meta.version ?? "1.0",
    lastModified: meta.lastModified ? Number(meta.lastModified) : 0,
    _version: meta._version ? Number(meta._version) : undefined,
    categories,
  };
}

/**
 * 整份写入（事务内全量快照）。
 * 事务保证：要么全部替换成功，要么保持原状。
 */
export async function writeNavData(data: NavData): Promise<void> {
  await ensureTables();
  const db = getClient();

  const statements: ({ sql: string; args: (string | number | null)[] } | string)[] = [
    "DELETE FROM sites",
    "DELETE FROM categories",
  ];

  for (const cat of data.categories) {
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
}
