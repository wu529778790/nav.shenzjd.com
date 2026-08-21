# 功能设计 Spec · 失效标注（M2，手动报失效模式）

> 状态：已实现（2026-08-22，用户拍板手动模式）
> 前置：与 M1 点赞共用同一套匿名身份（HttpOnly `anon_id` cookie）

---

## 目标

匿名用户可对站点「报失效」；有报告的站点在全站标注为「已失效」（卡片置灰 + chip）；M3 后台据此**手动核验**并删除失效站点。

---

## 用户决策（已对齐）

- **不做自动健康检查**（原方案：调度器/服务器 cron/密钥，全部砍掉）。改为：
  `用户匿名点击「报失效」→ 数据入库 → M3 后台手动检测 / 删除`
- 身份：匿名（HttpOnly `anon_id` cookie，与 M1 点赞同一套）
- 页面展示：**仅标注失效站**（置灰 + 「已失效」chip），不做筛选切换

---

## 数据模型

```sql
CREATE TABLE site_dead_reports (
  site_id    TEXT NOT NULL,
  anon_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,   -- unix ms
  UNIQUE(site_id, anon_id)
);
CREATE INDEX idx_site_dead_reports_site ON site_dead_reports(site_id);
CREATE INDEX idx_site_dead_reports_anon ON site_dead_reports(anon_id);
```

- 表通过 `turso.ts` 的 `ensureTables()` **幂等自建**（IF NOT EXISTS），无需迁移脚本。
- 报告数读取时聚合：`SELECT site_id, COUNT(*) FROM site_dead_reports GROUP BY site_id`。
- `sites` / `categories` 表不动。

---

## API

| 方法 | 路径 | 行为 |
|---|---|---|
| `POST`   | `/api/sites/:siteId/dead-report` | 报失效（`INSERT OR IGNORE` 幂等），返回 `{ reported: true, count }` |
| `DELETE` | `/api/sites/:siteId/dead-report` | 取消报失效（幂等），返回 `{ reported: false, count }` |

- **anon_id**：首次请求下发 HttpOnly cookie（1 年，`sameSite: lax`，生产 `secure`）。
- **限流**：单 `anon_id` 过去 1h 内新增报告 ≤ 30，超限 `429 { error: "操作太频繁，请稍后再试" }`。
- **404**：siteId 不存在。
- 运行时 `nodejs`。

---

## SSR 注入

`page.tsx` 读 `anon_id` cookie → `getReportCounts()` + `getReportedSiteIds(anonId)` → 注入 `initialReportCounts`（`Record<siteId, count>`）+ `initialReportedSiteIds`（`string[]`）→ `HomeClient` → `StaticBoard`。失败降级为空。

---

## UI（StaticBoard）

- 卡片结构改为 `div.group.relative` 包裹：
  - `<a>` 保留 `site-card` 卡片样式（`h-full` 填满网格行高，保持同排等高）
  - **右上角独立 `<button>`**（原三点菜单位置）→ 避免 button 嵌套 `<a>` 的非法 HTML
- **⚑ 按钮**：未报=空心灰、hover 才显示；已报=实心 + `--error` 色 + 常显；`count > 0` 常显并显示数字
- **标注**：`count ≥ 1` → `<a>` 加 `opacity-70` 置灰 + 底部「已失效 · N」chip（`--error` 色）
- **交互**：点击乐观更新（立即 ±1 + 切换 ⚑ 状态）→ `POST`/`DELETE` → 成功以服务端返回覆盖 / 失败回滚 + 底部轻量 toast（自实现，无依赖）
- 标题 `line-clamp-2` 已在上一个提交落地；`pr-6` 避让右上角按钮

---

## 文件变更

| 文件 | 变更 |
|---|---|
| `src/lib/server/turso.ts` | 新增 `site_dead_reports` 表 + 索引；导出 `getClient()` / `ensureTables()` |
| `src/lib/server/reports.ts` (新) | counts / reportedSet / add / remove / 限流查询 |
| `src/app/api/sites/[siteId]/dead-report/route.ts` (新) | POST/DELETE + anon_id cookie + 限流 + 404 |
| `src/app/page.tsx` | 注入失效数据 |
| `src/components/HomePage/HomeClient.tsx` | props 透传 |
| `src/components/HomePage/StaticBoard.tsx` | ⚑ 按钮 + chip + 置灰 + 乐观更新 + toast |

---

## 不做（本轮）

- 自动健康检查 / 调度器 / 密钥
- 失效筛选切换、排序调整
- 后台核验 / 删除（→ M3）
- 全局搜索结果的失效标注（后续统一）

---

## 验收（M2 完工标准）

- [x] 匿名报失效 / 取消幂等（`INSERT OR IGNORE` / `DELETE`）
- [x] 已报站点全站标注「已失效」（置灰 + chip + ⚑ 常显）
- [x] 限流：单 anon_id 1h > 30 次 → 429
- [x] 刷新后状态保持（cookie + SSR 注入，首屏无闪烁）
- [x] `npm run lint` / `npx tsc --noEmit` / `npm test` 通过
- [ ] `npm run build` / CI 绿（构建验证中）

---

## 下一步

M3 后台：列出全部 `site_dead_reports` 聚合站点（含 URL、报告数、最近报告时间）→ 一键打开核验 → 「删除站点」/「清除报告」。核验通过后据此清理失效站。
