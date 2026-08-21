# 功能设计 Spec · 点赞 + 热度排序（M1）

> 状态：待确认
> 创建：2026-08-22
> 范围：M1（匿名点赞 + 站点按 like_count 排序）。失效检测 → M2，后台 → M3。

---

## 目标

访客可对任意站点点赞；同一分类内，按 `like_count` 降序排列，越热门越靠前。匿名无登录。

---

## 用户决策（已对齐）

- **身份**：点赞完全匿名（HttpOnly cookie 随机 uuid）；后台单独走身份鉴权（M3 再设计）。
- **节奏**：分阶段——M1 点赞+排序 → M2 失效检测 → M3 后台管理。

---

## 范围 / 非范围

**M1 做**
- 匿名点赞 / 取消点赞（幂等）
- 站点卡片显示 ♥ + 计数，"已赞" / "未赞" 状态
- 同一分类内默认 `like_count DESC` 排序
- 按 anon_id 的频率限流（防脚本）

**M1 不做**
- 登录、OAuth、用户主页、点赞通知/动态
- 失效检测、健康检查（→ M2）
- 后台管理、鉴权（→ M3）
- 排序切换 toggle（热度/字母/原始）—— 留到 M+

---

## 身份（匿名）

- 首次点赞请求时，服务端下发 `HttpOnly` cookie `anon_id`（随机 uuid，无 PII）。
- 该 cookie 即"身份"：浏览器层面唯一。清 cookie = 新身份（接受，个人导航站恶意刷量收益低）。
- 不登录、无 UI、无第三方 SDK。

---

## 数据模型（Turso）

新增一张表，**不动 `sites` 表**，保持兼容：

```sql
CREATE TABLE site_likes (
  site_id    TEXT NOT NULL,
  anon_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,  -- unix ms
  UNIQUE(site_id, anon_id)
);
CREATE INDEX idx_site_likes_site ON site_likes(site_id);
CREATE INDEX idx_site_likes_anon ON site_likes(anon_id);
```

`like_count` **不在 sites 表物化**，读取时聚合：

```sql
SELECT site_id, COUNT(*) AS c FROM site_likes GROUP BY site_id;
```

2757 站量级，单次 GROUP BY 毫秒级。后续量上来再换物化列 + 触发式更新。

---

## API

| 方法 | 路径 | 行为 |
|---|---|---|
| `POST`   | `/api/sites/:siteId/like` | 若 `(siteId, anon_id)` 已存在 → 200 幂等返回当前 count；否则 insert，返回 `{ liked: true, count }`。无 `anon_id` cookie 时 set-cookie 后再 insert。**限流 60 次/小时/anon_id**。 |
| `DELETE` | `/api/sites/:siteId/like` | delete by `(siteId, anon_id)`，返回 `{ liked: false, count }`。同样限流。 |
| 读（SSR 内嵌） | — | `readNavData` 增查 `likeCount` map + 当前 anonId 的 `likedSiteIds` set，一并注入 props。 |

错误码：`429`（限流）/ `404`（siteId 不存在）/ `500`（DB 异常）。

---

## 排序

- 分类内站点默认：`like_count DESC, title ASC`。
- **不**做全局排序（每个分类独立排）。
- 暂不做"最新/字母/原始"切换 toggle（留 M+）。
- 排序在 `readNavData` 服务端完成，SSR 直出，无客户端计算。

---

## UI（站点卡片）

在标题 + 描述之下加一行"互动条"：

```
[ ♥ 12 ]   ← 整行可点，stopPropagation 防止冒泡到外层 <a>
```

- **未赞**：空心 ♥ + 灰色数字
- **已赞**：实心 ♥（accent 色）+ 黑色数字
- **点击**：
  1. 立即乐观更新（+1 / -1 + 切换 ♥ 状态）
  2. 发 POST/DELETE
  3. 失败回滚 + toast 提示
- **首屏正确**：`likedSiteIds` 由 SSR 注入，不闪烁。

---

## 限流 / 防滥用

- 滑动窗口：同一 `anon_id` 过去 1h 内 like+unlike 总动作 ≤ 60。
- 超限 `429`，前端 toast「操作太频繁，稍后再试」。
- **不**引入 IP 限流（M1）；如需要，挪到反代层（Cloudflare / nginx）后续加。
- **不**接 CAPTCHA；M1 接受 anon_id 重置漏洞。

---

## SSR 数据流变更

`src/app/page.tsx` → `readNavData(categories, sites, currentAnonId)` 增查两段：

```ts
// 1. 所有站点的 like_count
SELECT site_id, COUNT(*) c FROM site_likes GROUP BY site_id;
// → Map<siteId, number>

// 2. 当前 anon_id 已赞的 site_id 集合
SELECT site_id FROM site_likes WHERE anon_id = ?;
// → Set<siteId>
```

合并进树：每个 `site` 加 `likeCount` 字段；`readNavData` 排序时按 `likeCount DESC, title ASC` 对每个分类的 `sites` 重排。

`HomeClient` props 新增 `likedSiteIds: Set<string>`，用于卡片初始 ♥ 状态。本地维护 `optimisticLikes` 状态做乐观更新。

---

## 迁移

- 新表 `site_likes` 通过 `scripts/add-site-likes-table.mjs`（幂等 CREATE IF NOT EXISTS）执行。
- 现有数据**无影响**（点赞数从 0 开始）。
- 不需要回填、不需要改 `reset-tables.mjs`（它是破坏性的，仅手动重置用）。

---

## 文件变更预估

| 文件 | 变更 |
|---|---|
| `src/lib/server/turso.ts` | 新增 `site_likes` 相关查询（count / likedSet / insert / delete） |
| `src/app/page.tsx` | 读 cookie `anon_id` → 注入 `readNavData` |
| `src/lib/server/likes.ts` (新) | `likeSite(anonId, siteId)` / `unlikeSite` / `getCounts` / `getLikedSet` / `checkRateLimit` |
| `src/app/api/sites/[siteId]/like/route.ts` (新) | POST/DELETE；限流；返回 count |
| `src/components/HomePage/StaticBoard.tsx` | 卡片新增 ♥ 行 + 乐观更新 + 触发 mutate |
| `src/components/HomePage/HomeClient.tsx` | 接收 `likedSiteIds`、维护 `optimisticLikes` |
| `scripts/add-site-likes-table.mjs` (新) | 幂等建表 |
| `package.json` | 不新增依赖（用 `cookies()` from `next/headers`） |

预估 6 个新/改文件，无新依赖。

---

## 风险 / 取舍

| 风险 | 应对 |
|---|---|
| anon_id 可重置（清 cookie = 新身份） | 接受；M3 后台可加 IP 维度 |
| 写路径从 0 到 1（之前纯只读） | 复用 Turso `turso.ts` 的 client；统一错误处理；Turso token 已有写权限 |
| 排序跨刷新稳定 | likeCount 同分用 `title ASC` 兜底，确定性 |
| 乐观更新与 SSR 数据一致性 | mutate 后 `router.refresh()` 重新拉 SSR；或先乐观后服务端确认 |
| 大规模并发点赞（刷接口） | anon_id 限流 60/h；M1 不上 IP 限流 |

---

## 验收（M1 完工标准）

- [ ] 未登录访客可对任意站点点赞 / 取消
- [ ] 同一 anon_id 重复点同一站 → 幂等，不重复计数
- [ ] 限流：单 anon_id 1h 内 >60 次 → 429
- [ ] 分类内站点按 `like_count DESC` 排序，SSR 直出
- [ ] 卡片显示真实计数；首屏"已赞"状态无闪烁
- [ ] 失败回滚有 toast 提示
- [ ] `npm run lint` / `npx tsc --noEmit` / `npm run build` 全通过
- [ ] CI 绿

---

## 下一步

你确认这份 Spec（特别是**身份 / 数据模型 / 排序规则 / 限流阈值**），我就按上面的"文件变更预估"开始落地 M1。完成后再走 M2（失效检测）的设计 Spec。
