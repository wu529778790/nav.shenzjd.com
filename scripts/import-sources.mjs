/**
 * 多数据源 → Turso 树形数据灌入脚本（2026-08-22 多源合并版）
 *
 * 数据源（默认两个，均可通过 --sources 指定）：
 * - ~/github/navdata/data/axutongxue.json（阿虚同学的储物间）
 * - ~/github/navdata/data/luckman.json（luckman补给营地）
 *
 * 合并策略：
 * - 各源顶级分类**并列**（axutongxue 01-14 体系 + luckman A-Z 体系）
 * - 全局 URL 去重（按数据源顺序优先，axutongxue 在前 → 重复时保留 axutongxue）
 * - 每个源内部沿用过滤：分隔线 / 特惠福利精选 / 微信公众文章 / 网盘分享类
 * - luckman 特例：剔除「生活 ︱ 流量、破解 E 💰」顶级分类（破解软件/返利/外卖券等广告灰色内容）
 *
 * 用法: node scripts/import-sources.mjs [--sources a.json,b.json] [--dry-run]
 * 环境变量从仓库根 .env 读取。
 */

import { createClient } from "@libsql/client";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// -------------------- 参数解析 --------------------
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const sourcesIdx = args.indexOf("--sources");
const DATA_DIR = path.join(os.homedir(), "github", "navdata", "data");
const SOURCES =
  sourcesIdx > -1 && args[sourcesIdx + 1]
    ? args[sourcesIdx + 1].split(",").map((s) => s.trim()).filter(Boolean)
    : ["axutongxue.json", "luckman.json"];

// -------------------- 环境变量 --------------------
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^TURSO_(DATABASE_URL|AUTH_TOKEN)=(.+)$/);
    if (m) process.env[`TURSO_${m[1]}`] = m[2].trim();
  }
}
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("缺少 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN（.env）");
  process.exit(1);
}

// -------------------- 稳定短哈希 --------------------
function shortHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(8, "0").slice(0, 8);
}

// 全局序号生成器：避免同名子分类 / 同 url 站点在不同分支产生冲突 id
let seq = 0;
const nextSeq = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

function catId(node) {
  return `cat-${shortHash(node.name)}-${nextSeq()}`;
}

function siteId(categoryId, item) {
  return `site-${shortHash(categoryId)}-${shortHash(item.url || item.title)}-${nextSeq()}`;
}

// 提取 emoji 作为 icon（分类名里的）
function extractEmoji(s) {
  if (!s) return undefined;
  const m = s.match(
    /(?:\p{Extended_Pictographic}[\u{FE00}-\u{FE0F}]?(?:\u200d\p{Extended_Pictographic}[\u{FE00}-\u{FE0F}]?)*)/u
  );
  return m ? m[0] : undefined;
}

// -------------------- 过滤规则 --------------------
const skipNames = new Set(["分隔线"]);

/** 广告分类整树剔除 */
const skipCatNameRe = /特惠福利精选|流量、破解/;

/** 微信公众文章 URL（广告） */
function isWeixinArticle(url) {
  return typeof url === "string" && /mp\.weixin\.qq\.com/i.test(url);
}

/** 网盘 / 内容分享类链接（非正经网站）
 * 知乎问答、各大网盘分享盘（百度/夸克/城通/MediaFire/蓝奏云/阿里云盘/迅雷云盘/天翼云盘/123/华硕/Syncplicity/移动云盘） */
const NON_STANDARD_URL_RE =
  /(?:zhihu\.com|pan\.baidu\.com|pan\.quark\.cn|ctfile\.com|mediafire\.com|lanzou[a-z]*\.(?:com|cn|net|org)|aliyundrive\.com|syncplicity\.com|ysepan\.com|pan\.xunlei\.com|cloud\.189\.cn|asuswebstorage\.com|123pan\.com)/i;
function isNonStandardUrl(url) {
  return typeof url === "string" && NON_STANDARD_URL_RE.test(url);
}

/** URL 归一化（去协议/尾部斜杠/小写）→ 去重键 */
function normalizeUrl(u) {
  return (u || "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

// -------------------- 递归转换 --------------------
const seenUrls = new Set(); // 全局去重（跨源）

function buildNode(node, parentId, depth, stats) {
  const name = (node.name || "").trim();
  if (skipNames.has(name) || skipCatNameRe.test(name)) return null;

  const category = {
    id: catId(node),
    parentId,
    name,
    icon: extractEmoji(name) || (depth === 0 ? "📁" : undefined),
    sort: 0,
    sites: [],
    children: [],
  };

  const pushSite = (item, extra = {}) => {
    const n = normalizeUrl(item.url);
    if (seenUrls.has(n)) {
      stats.dupSkipped++;
      return;
    }
    seenUrls.add(n);
    category.sites.push({
      id: siteId(category.id, item),
      title: item.title,
      url: item.url,
      description: extra.description,
      sort: category.sites.length,
      createdAt: item.added || undefined,
    });
  };

  // items → sites
  for (const item of node.items || []) {
    const type = item.type || "normal";
    // note / 无 url 且非 expandable → 跳过
    if (!item.url && type !== "expandable") continue;
    // 微信公众文章 / 网盘分享 → 跳过
    if (isWeixinArticle(item.url) || isNonStandardUrl(item.url)) {
      stats.filtered++;
      continue;
    }

    if (type === "expandable" && Array.isArray(item.links) && item.links.length > 0) {
      // 展开为多个 site，title 用「父标题 · 子标题」避免丢失上下文
      for (const link of item.links) {
        if (!link.url) continue;
        if (isWeixinArticle(link.url) || isNonStandardUrl(link.url)) {
          stats.filtered++;
          continue;
        }
        pushSite(link, { description: item.title });
      }
    } else {
      pushSite(item, { description: type === "mirror" ? "备用地址" : undefined });
    }
  }

  // children → 子树
  for (const child of node.children || []) {
    const childName = (child.name || "").trim();
    if (skipNames.has(childName)) continue;
    const built = buildNode(child, category.id, depth + 1, stats);
    if (built) category.children.push(built);
  }

  return category;
}

// -------------------- 多源转换 --------------------
const roots = [];
const perSource = [];
let topSort = 0;

for (const file of SOURCES) {
  const srcPath = path.join(DATA_DIR, file);
  if (!fs.existsSync(srcPath)) {
    console.error("数据源不存在:", srcPath);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(srcPath, "utf8"));
  const stats = { filtered: 0, dupSkipped: 0 };
  const sourceRoots = [];

  for (const rc of raw.categories || []) {
    const name = (rc.name || "").trim();
    if (skipNames.has(name)) continue;
    const built = buildNode(rc, null, 0, stats);
    if (built) {
      built.sort = topSort++; // 顶级分类按源顺序全局编号
      sourceRoots.push(built);
    }
  }

  roots.push(...sourceRoots);
  perSource.push({ site: raw.site, file, roots: sourceRoots, stats });
  console.log(
    `数据源 ${raw.site} (${raw.site_url}): 顶级分类 ${sourceRoots.length} 个 | ` +
      `过滤 ${stats.filtered} / 去重跳过 ${stats.dupSkipped}`
  );
}

// 统计
let totalCats = 0;
let totalSites = 0;
const count = (cats) => {
  for (const c of cats) {
    totalCats++;
    totalSites += c.sites.length;
    if (c.children?.length) count(c.children);
  }
};
count(roots);

const navData = {
  version: "1.0",
  lastModified: Date.now(),
  _version: 1,
  categories: roots,
};

console.log("\n转换完成：分类节点 " + totalCats + " 个，站点 " + totalSites + " 条（最深 " + maxDepth(roots) + " 层）");
console.log("顶级分类:");
roots.forEach((c) => console.log(`  ${c.icon || "📁"} ${c.name} (子 ${c.children?.length ?? 0} 节点 / ${c.sites.length} 站点)`));

function maxDepth(cats, d = 1) {
  let m = d;
  for (const c of cats) {
    if (c.children?.length) m = Math.max(m, maxDepth(c.children, d + 1));
  }
  return m;
}

if (dryRun) {
  console.log("\n[dry-run] 仅打印，不写入数据库");
  process.exit(0);
}

// -------------------- 建表 + 写入 --------------------
const db = createClient({ url, authToken });
const CREATE_TABLES = [
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY, parent_id TEXT, name TEXT NOT NULL, icon TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    _deleted INTEGER NOT NULL DEFAULT 0, deleted_at TEXT, updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY, category_id TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL,
    favicon TEXT, description TEXT, sort INTEGER NOT NULL DEFAULT 0,
    _deleted INTEGER NOT NULL DEFAULT 0, deleted_at TEXT, updated_at TEXT, created_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS nav_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS site_dead_reports (
    site_id TEXT NOT NULL, anon_id TEXT NOT NULL, created_at INTEGER NOT NULL,
    UNIQUE(site_id, anon_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sites_category ON sites(category_id)`,
  `CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_site_dead_reports_site ON site_dead_reports(site_id)`,
  `CREATE INDEX IF NOT EXISTS idx_site_dead_reports_anon ON site_dead_reports(anon_id)`,
];
for (const sql of CREATE_TABLES) {
  await db.execute(sql);
}

// 递归展平 + 生成 INSERT 语句
const stmts = ["DELETE FROM sites", "DELETE FROM categories"];
const walk = (cats) => {
  for (const c of cats) {
    stmts.push({
      sql: `INSERT INTO categories (id, parent_id, name, icon, sort, _deleted, deleted_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 0, NULL, NULL)`,
      args: [c.id, c.parentId, c.name, c.icon || null, c.sort ?? 0],
    });
    for (const s of c.sites) {
      stmts.push({
        sql: `INSERT INTO sites (id, category_id, title, url, favicon, description, sort,
                                _deleted, deleted_at, updated_at, created_at)
              VALUES (?, ?, ?, ?, NULL, ?, ?, 0, NULL, NULL, ?)`,
        args: [s.id, c.id, s.title, s.url, s.description || null, s.sort ?? 0, s.createdAt || null],
      });
    }
    if (c.children?.length) walk(c.children);
  }
};
walk(roots);

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

console.log("\n开始写入 Turso（事务原子，全量替换旧数据）...");
const t0 = Date.now();
await db.batch(stmts);
console.log(`写入完成，耗时 ${Date.now() - t0} ms`);

// 验证
const [catRs, siteRs, rootRs] = await db.batch([
  "SELECT COUNT(*) AS n FROM categories",
  "SELECT COUNT(*) AS n FROM sites",
  "SELECT COUNT(*) AS n FROM categories WHERE parent_id IS NULL",
]);
console.log(
  `验证：categories=${catRs.rows[0].n}, sites=${siteRs.rows[0].n}, 顶级分类=${rootRs.rows[0].n}`
);
