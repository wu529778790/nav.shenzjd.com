# 功能设计 Spec · 后台管理（M3，GitHub 登录 + 删除失效站点）

> 状态：设计中（2026-08-22）
> 前置：M2 失效标注（site_dead_reports）已上线；数据存 Turso。

---

## 目标

站点主可**用 GitHub 登录**进入 `/admin` 后台，查看全部被匿名用户「报失效」的站点（聚合报告数、最近报告时间），一键**打开核验** → **删除失效站点** / **清除报告**。

---

## 用户决策（已对齐）

- 登录方式：**GitHub OAuth**（Authorization Code 流，服务端换 token）。只认 `ADMIN_GITHUB_LOGIN`（默认 `wu529778790`）一个账号，无多角色系统。
- 删除即真删：从 `sites` 表删除该行（本项目是纯只读展示站，无需墓碑/同步传播）。
- 删除站点时**连带清除**该站点的全部失效报告；也支持「只清报告不删站」（误报场景）。
- 后台不提供站点编辑/新增（本轮只做「核验 + 删除」闭环）。

---

## 身份（GitHub OAuth + HMAC Session）

### 登录流程

```
GET /api/auth/github
  → 生成 state（crypto 随机串，存 HttpOnly cookie `oauth_state`，5 分钟）
  → 302 https://github.com/login/oauth/authorize?client_id&state&scope=read:user

GET /api/auth/github/callback?code&state
  → 校验 state（防 CSRF，与 cookie 比对）
  → POST https://github.com/login/oauth/access_token（client_id+client_secret+code，Accept: application/json）
  → GET https://api.github.com/user（Authorization: Bearer <access_token>）
  → 校验 user.login === ADMIN_GITHUB_LOGIN；不匹配 → 403 页面
  → 签发 session cookie → 302 /admin
```

### Session

- Cookie：`admin_session`，HttpOnly / SameSite=Lax / Secure（生产）/ path=/ / 7 天。
- 无第三方依赖：Node `crypto` HMAC-SHA256 签名。
- Token 格式：`base64url(JSON{sub, exp}).base64url(hmac)`，密钥 `AUTH_SECRET`（≥32 字符）。
- 校验：重算 HMAC `timingSafeEqual` + `exp` 过期检查 + `sub === ADMIN_GITHUB_LOGIN`。

### 登出

`POST /api/auth/logout` → 清 `admin_session` cookie → 302 `/admin`。

---

## 数据查询（src/lib/server/admin.ts）

### 失效站点聚合列表

```sql
SELECT
  s.id, s.title, s.url, s.favicon, s.description, s.category_id,
  c.name AS category_name,
  COUNT(r.site_id)                                  AS report_count,
  MAX(r.created_at)                                 AS last_report_at
FROM sites s
JOIN site_dead_reports r ON r.site_id = s.id
LEFT JOIN categories c   ON c.id = s.category_id
GROUP BY s.id
ORDER BY report_count DESC, last_report_at DESC;
```

> `LEFT JOIN categories`：防 category_id 悬空（分类已删但站点残留）。

### 删除站点

```sql
BEGIN;
DELETE FROM site_dead_reports WHERE site_id = ?;
DELETE FROM sites            WHERE id = ?;
COMMIT;
```

### 清除报告

```sql
DELETE FROM site_dead_reports WHERE site_id = ?;
```

---

## API

| 方法 | 路径 | 鉴权 | 行为 |
|---|---|---|---|
| `GET`    | `/api/auth/github` | 无 | 发起 OAuth 登录（302） |
| `GET`    | `/api/auth/github/callback` | 无 | 回调：换 token → 校验 → 发 session |
| `POST`   | `/api/auth/logout` | 无 | 登出 |
| `GET`    | `/api/admin/dead-sites` | ✅ 管理员 | 聚合列表（含分类名） |
| `DELETE` | `/api/admin/sites/:siteId` | ✅ 管理员 | 删站点 + 清报告，404 站点不存在 |
| `DELETE` | `/api/admin/sites/:siteId/reports` | ✅ 管理员 | 只清报告，404 站点不存在 |

- 鉴权失败：`401 { error: "未登录或登录已过期" }`；非管理员（理论上进不来）：`403`。
- 运行时 `nodejs`（OAuth + crypto 需要）。

---

## 页面

### `/admin`（Server Component，force-dynamic）

- 未登录：渲染登录卡片（GitHub logo + 「使用 GitHub 登录」按钮 → `/api/auth/github`）。
- 已登录：SSR 直读 `getDeadSites()` → 渲染列表（`AdminClient` 客户端组件接收初始数据）。
- 顶部：标题 + 当前登录名 + 「登出」按钮。
- 统计条：共 N 个失效站点、总报告数。

### `AdminClient`（Client Component）

列表每项（复用 `.card` 样式）：

```
[标题]                    [报告数 chip] [最近报告时间]
[URL]
[所属分类]  打开核验 ↗ | 清除报告 | 删除站点
```

- 「打开核验」：`<a target="_blank">` 直达站点 URL。
- 「清除报告」/「删除站点」：确认（`window.confirm`，删除站点需二次确认文案写明后果）→ 乐观移除行 → 调用 DELETE API → 失败回滚 + 轻量 toast（沿用 M2 自实现 toast 模式）。
- 删除后列表为空 → 空状态「没有失效站点 🎉」。

---

## 文件变更

| 文件 | 变更 |
|---|---|
| `.env` / `.env.example` | 新增 `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `AUTH_SECRET` / `ADMIN_GITHUB_LOGIN`（secret 只进 .env，不进 git） |
| `src/lib/server/auth.ts` (新) | session token 签发/校验、`requireAdmin(request)`、`ADMIN_GITHUB_LOGIN` 常量 |
| `src/lib/server/admin.ts` (新) | `getDeadSites()` / `deleteSite()` / `clearSiteReports()` |
| `src/app/api/auth/github/route.ts` (新) | 发起 OAuth |
| `src/app/api/auth/github/callback/route.ts` (新) | 回调 + 校验 + 发 session |
| `src/app/api/auth/logout/route.ts` (新) | 登出 |
| `src/app/api/admin/dead-sites/route.ts` (新) | 聚合列表 |
| `src/app/api/admin/sites/[siteId]/route.ts` (新) | 删除站点 |
| `src/app/api/admin/sites/[siteId]/reports/route.ts` (新) | 清除报告 |
| `src/app/admin/page.tsx` (新) | 后台页（SSR） |
| `src/app/admin/AdminClient.tsx` (新) | 列表交互组件 |

---

## 安全要点

- `GITHUB_CLIENT_SECRET` / `AUTH_SECRET` 仅存 `.env`（已被 .gitignore 排除）；Docker 部署时由服务器环境注入同套变量。
- OAuth `state` 防 CSRF：回调校验与 cookie 严格比对（`timingSafeEqual`），5 分钟过期。
- Session 校验走 `timingSafeEqual`，防时序攻击。
- 后台 API 全部校验 session；无 session 一律 401。
- GitHub 回调 URL 需在 GitHub App 配置：`https://navhub.shenzjd.com/api/auth/github/callback`。

---

## 验收（M3 完工标准）

- [ ] 未登录访问 `/admin` 显示 GitHub 登录卡片
- [ ] GitHub 登录成功后进入后台，列表展示全部失效站点（标题/URL/分类/报告数/最近时间）
- [ ] 「打开核验」新标签页直达站点
- [ ] 「删除站点」确认后站点 + 报告一并删除，列表即时更新；首页对应卡片消失
- [ ] 「清除报告」仅清报告，站点保留
- [ ] 非 `ADMIN_GITHUB_LOGIN` 的 GitHub 账号登录 → 403
- [ ] 登出后回到登录卡片
- [ ] `npm run lint` / `npx tsc --noEmit` / `npm test` / `npm run build` 通过

---

## 不做（后续）

- 站点编辑/新增、分类管理（本轮只做核验删除）
- 多管理员 / 角色系统
- 审计日志、操作记录
