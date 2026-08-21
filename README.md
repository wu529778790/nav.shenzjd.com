# NavHub · 树形导航站

> 一个纯展示型的个人导航站。书签数据来自 [阿虚同学的储物间](https://axutongxue.com) 等精选来源，以**树形分类**组织，服务端直读 **Turso (libsql)** 数据库，首屏 SSR 秒开。无登录、无编辑、无同步——数据由 `navdata` 工具链维护。

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js) ![React](https://img.shields.io/badge/React-19-61dafb?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript) ![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss) ![Turso](https://img.shields.io/badge/Storage-Turso-7C3AED) ![License](https://img.shields.io/badge/License-MIT-green) ![CI](https://img.shields.io/github/actions/workflow/status/wu529778790/navhub.shenzjd.com/docker.yml)

## 特性

- **树形分类导航** — 左侧递归树，整行可点击；文件夹图标 = 可下钻分类，链接图标 = 直达站点。默认收起，导航时自动展开当前路径。
- **首屏 SSR 秒开** — 服务端直读 Turso 渲染当前分类的站点网格与子分类入口，无骨架屏、无客户端等待。
- **全局搜索** — `⌘K` 唤起，跨整棵树全文检索，结果按顶级分类分组。
- **极简视觉** — Vercel / Linear 风格单色设计：白底、黑字、黄色强调（`#FFD400`）、1px 边框、无阴影（无暗色模式）。
- **响应式** — 桌面端固定左树 + 内容区；移动端折叠为抽屉式树。

## 技术栈

- Next.js 16（App Router）+ React 19 + TypeScript（strict）
- Tailwind CSS v4（CSS-first 配置，无 `tailwind.config.js`）
- Turso / libsql（服务端数据库，树形 `categories` + `sites` 表）
- Plus Jakarta Sans 自托管可变字体
- Vitest（测试）

## 快速开始

### 1. 准备 Turso 数据库

在 [Turso](https://turso.tech) 创建数据库，获取数据 URL 与 auth token。

### 2. 配置环境变量

```bash
cp .env.example .env
```

| 变量 | 说明 |
| --- | --- |
| `TURSO_DATABASE_URL` | 必填，数据库连接 URL（如 `libsql://xxx.turso.io`） |
| `TURSO_AUTH_TOKEN` | 必填，访问令牌（服务端专用，切勿提交到仓库） |

> Docker 部署时环境变量在**容器运行时**注入即可，不依赖镜像构建阶段。

### 3. 导入数据（首次部署）

数据由外部 `navdata` 工具链产出。将阿虚同学储物间数据灌入 Turso：

```bash
# 重建表结构（如需）
node scripts/reset-tables.mjs
# 导入（默认读取 ~/github/navdata/data/axutongxue.json）
node scripts/import-axutongxue.mjs [--source <path>] [--dry-run]
```

环境变量从仓库根 `.env` 读取。

### 4. 运行

```bash
npm install
npm run dev      # http://localhost:3000
```

## Docker 部署

镜像由 GitHub Actions 自动构建并推送至 GHCR（多阶段构建 + Next.js `standalone` 输出）。容器运行时注入 Turso 环境变量即可：

```bash
docker run -d -p 3000:3000 \
  -e TURSO_DATABASE_URL=libsql://xxx.turso.io \
  -e TURSO_AUTH_TOKEN=your_token \
  ghcr.io/wu529778790/navhub.shenzjd.com:main
```

## 数据模型

Turso 中规范化为三张表：

```text
categories { id, name, parent_id(NULL=顶级), sort, ... }
sites      { id, category_id(FK), title, url, favicon, description, ... }
nav_meta   { key, value }
```

- `categories` 通过 `parent_id` 自引用构成任意深度的树（当前数据最深 5 层，14 个顶级分类，约 2757 个站点）。
- `sites.description === "备用地址"` 表示「备用链接」，前端以灰色 chip 标记。
- `src/data/sites.json` 为兜底种子（sitemap 生成时使用），运行时数据以 Turso 为准。

## 架构

```text
page.tsx (SSR) → readNavData() 直读 Turso → 过滤墓碑 → 注入 initialCategories → HomeClient
```

- 数据流单向、只读：服务端读取 → SSR 注入 → 客户端渲染。无 `localStorage`、无客户端写入。
- 安全响应头（CSP / HSTS 等）由 `src/proxy.ts`（Next 16 约定）统一注入，策略来自 `src/lib/runtime-policies.ts`。
- favicon 经 `/api/favicon` 代理并缓存，避免外链泄露与首屏阻塞。

## 文件结构

```text
src/
  app/
    layout.tsx           # 根布局（自托管字体 + ErrorBoundary）
    page.tsx             # SSR 直读 Turso，装配 HomeClient
    globals.css          # 极简单色主题（CSS 变量 + @theme inline）
    api/favicon/         # favicon 代理
    robots.ts / sitemap.ts
  components/
    layout/    AppHeader, AppLayout
    HomePage/  Sidebar, HomeClient, StaticBoard, BentoGrid
    FaviconImage, ErrorBoundary
  lib/
    server/turso.ts      # Turso 数据层（树形读取/写入）
    runtime-policies.ts  # CSP 头构造
    favicon-url.ts, utils.ts (cn)
scripts/                 # import-axutongxue, reset-tables, sync-standalone-assets, submit-sitemap
```

## 开发

```bash
npm run dev          # 开发服务器
npm run build        # 生产构建（next build + 同步 standalone 静态资源）
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
npm test -- --run    # 运行测试（Vitest，一次性）
npm run format       # Prettier 格式化
```

CI 顺序：`lint → type-check → test --run → build`，通过后自动构建镜像并部署。

## License

MIT
