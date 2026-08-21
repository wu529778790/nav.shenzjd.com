/**
 * navdata → Turso 数据灌入脚本
 *
 * 来源数据：~/github/navdata 项目产出的 merged_navdata.json（4378 条去重唯一链接）
 * 数据格式：扁平 links 数组 + meta，按 category_path 分组 → 转化为 NavHub 的 Category[] 结构
 *
 * 用法:
 *   node scripts/import-navdata.mjs [--source <path>] [--dry-run]
 *
 * 默认 source: ~/github/navdata/data/merged_navdata.json
 * 环境变量从仓库根 .env.local 读取 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
 */

import { createClient } from "@libsql/client";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// -------------------- 参数解析 --------------------
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const sourceIdx = args.indexOf("--source");
const SOURCE_PATH =
  sourceIdx > -1 && args[sourceIdx + 1]
    ? args[sourceIdx + 1]
    : path.join(os.homedir(), "github", "navdata", "data", "merged_navdata.json");

// -------------------- 环境变量 --------------------
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^TURSO_(DATABASE_URL|AUTH_TOKEN)=(.+)$/);
    if (m) process.env[`TURSO_${m[1]}`] = m[2].trim();
  }
}
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("缺少 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN（.env.local）");
  process.exit(1);
}

// -------------------- 读取数据 --------------------
if (!fs.existsSync(SOURCE_PATH)) {
  console.error("数据源不存在:", SOURCE_PATH);
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(SOURCE_PATH, "utf8"));
const links = raw.links || [];
const meta = raw.meta || {};
console.log(`读取 ${links.length} 条链接，来源:`, meta.sources?.map((s) => s.site).join(" + "));

// -------------------- Emoji 提取 --------------------
// 提取第一个 emoji 字符作为分类图标（覆盖大多数 emoji + 复合 emoji + 数字/字母编号）
function extractEmoji(s) {
  if (!s) return undefined;
  const m = s.match(
    /(?:\p{Extended_Pictographic}[\u{FE00}-\u{FE0F}]?(?:‍\p{Extended_Pictographic}[\u{FE00}-\u{FE0F}]?)*)/u
  );
  return m ? m[0] : undefined;
}

// -------------------- 稳定短哈希 --------------------
// 用 key/url 的哈希做确定性 id（保证同一链接重复导入得到同一 id，便于 merge）
function shortHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(8, "0").slice(0, 8);
}

// -------------------- 数据转换 --------------------
// 第一段作顶级 Category 名（含 emoji 和字母/数字编号，原貌保留 —— 后续用户可在 UI 重命名）
function topCategory(pathStr) {
  return (pathStr || "").split("/")[0].trim() || "未分类";
}

// 提取前导数字编号（"01　影视"→ 1, "07　电脑常用"→ 7）用于 sort 排序；luckman A-Z 风格的归为字母序
function topCategorySort(name) {
  const m = name.match(/^(\d{1,2})/);
  if (m) return { group: "num", key: Number(m[1]) };
  const letter = name.match(/^[A-Z]/);
  if (letter) return { group: "letter", key: letter[0] };
  return { group: "z", key: 999 };
}

function comparator(a, b) {
  const sa = topCategorySort(a);
  const sb = topCategorySort(b);
  if (sa.group !== sb.group) {
    return ["num", "letter", "z"].indexOf(sa.group) - ["num", "letter", "z"].indexOf(sb.group);
  }
  if (sa.key !== sb.key) return sa.key - sb.key;
  return a.localeCompare(b);
}

// 按顶级分类分组
const buckets = new Map();
for (const l of links) {
  const top = topCategory(l.category_path);
  if (!buckets.has(top)) buckets.set(top, []);
  buckets.get(top).push(l);
}

// 构造 NavData（与 src/types/index.ts NavData 模型一致）
const categories = [...buckets.keys()].sort(comparator).map((catName, idx) => {
  const items = buckets.get(catName);
  // 按 clicks 降序 + 标题次排序（稳定展示）
  const sorted = [...items].sort(
    (a, b) => (b.clicks || 0) - (a.clicks || 0) || a.title.localeCompare(b.title, "zh-CN")
  );
  return {
    id: `cat-${shortHash(catName)}`,
    name: catName,
    icon: extractEmoji(catName) || "📁",
    sort: idx,
    sites: sorted.map((l) => {
      // 子路径信息作 description；超过 80 字截断
      const subPath = l.category_path.includes("/")
        ? l.category_path.split("/").slice(1).join(" / ").trim()
        : "";
      const descParts = [];
      if (subPath) descParts.push(subPath);
      if (l.source && meta.sources?.length > 1) descParts.push(`来源: ${l.source}`);
      if (l.clicks > 0) descParts.push(`点击 ${l.clicks.toLocaleString()}`);
      return {
        id: `site-${shortHash(l.key || l.url)}`,
        title: l.title,
        url: l.url,
        description: descParts.join(" · ") || undefined,
        sort: 0,
        createdAt: l.added || undefined,
        updatedAt: l.added || undefined,
      };
    }),
  };
});

const navData = {
  version: "1.0",
  lastModified: Date.now(),
  _version: 1,
  categories,
};

console.log(
  `\n分类 ${categories.length} 个，链接 ${categories.reduce((n, c) => n + c.sites.length, 0)} 条`
);
console.log("Top 5 分类:");
categories.slice(0, 5).forEach((c) => console.log(`  ${c.icon} ${c.name} (${c.sites.length})`));

if (dryRun) {
  console.log("\n[dry-run] 仅打印，不写入数据库");
  process.exit(0);
}

// -------------------- 建表 --------------------
const db = createClient({ url, authToken });
const CREATE_TABLES = [
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT, sort INTEGER NOT NULL DEFAULT 0,
    _deleted INTEGER NOT NULL DEFAULT 0, deleted_at TEXT, updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY, category_id TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL,
    favicon TEXT, description TEXT, sort INTEGER NOT NULL DEFAULT 0,
    _deleted INTEGER NOT NULL DEFAULT 0, deleted_at TEXT, updated_at TEXT, created_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS nav_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_sites_category ON sites(category_id)`,
];
for (const sql of CREATE_TABLES) {
  await db.execute(sql);
}

// -------------------- 批量写入 --------------------
// 与 src/lib/server/turso.ts 同源 SQL：DELETE 全量 + INSERT（事务原子）
console.log("\n开始写入 Turso（事务原子）...");
const t0 = Date.now();

const stmts = ["DELETE FROM sites", "DELETE FROM categories"];
for (const cat of categories) {
  stmts.push({
    sql: `INSERT INTO categories (id, name, icon, sort, _deleted, deleted_at, updated_at)
          VALUES (?, ?, ?, ?, 0, NULL, NULL)`,
    args: [cat.id, cat.name, cat.icon, cat.sort ?? 0],
  });
  for (const s of cat.sites) {
    stmts.push({
      sql: `INSERT INTO sites (id, category_id, title, url, favicon, description, sort,
                              _deleted, deleted_at, updated_at, created_at)
            VALUES (?, ?, ?, ?, NULL, ?, ?, 0, NULL, NULL, ?)`,
      args: [
        s.id,
        cat.id,
        s.title,
        s.url,
        s.description || null,
        s.sort ?? 0,
        s.createdAt || null,
      ],
    });
  }
}
stmts.push({
  sql: `INSERT INTO nav_meta (key, value) VALUES ('version', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
  args: ["1.0"],
});
stmts.push({
  sql: `INSERT INTO nav_meta (key, value) VALUES ('lastModified', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
  args: [String(navData.lastModified)],
});
stmts.push({
  sql: `INSERT INTO nav_meta (key, value) VALUES ('_version', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
  args: ["1"],
});

await db.batch(stmts);
console.log(`写入完成，耗时 ${Date.now() - t0} ms`);

// -------------------- 验证 --------------------
const [catRs, siteRs] = await db.batch([
  "SELECT COUNT(*) AS n FROM categories",
  "SELECT COUNT(*) AS n FROM sites",
]);
console.log(
  `\n验证：categories=${catRs.rows[0].n}, sites=${siteRs.rows[0].n}`
);