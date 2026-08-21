# NavHub · 导航站

> 一个简单的导航 / 书签管理网站。书签数据存储在 **Turso (libsql) 数据库**中——毫秒级读写、多设备实时同步，支持拖拽排序，数据随时可导出、可迁移。

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js) ![React](https://img.shields.io/badge/React-19-61dafb?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript) ![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss) ![License](https://img.shields.io/badge/License-MIT-green) ![CI](https://img.shields.io/github/actions/workflow/status/wu529778790/navhub.shenzjd.com/docker.yml)

## 为什么用数据库存储？

早期版本把书签存在 GitHub 仓库里（每次同步都是一次 Git 提交），换来的是**慢**——GitHub API 限流、请求延迟高。NavHub 现已切换为 Turso 数据库：

- **毫秒级读写** — 数据在东京节点（aws-ap-northeast-1），SSR 直读数据库，首屏秒开
- **全站私有** — 无登录、无访客模式，访问即读写，数据只属于你自己
- **规范化多表** — categories / sites 分表存储 + 外键 + 索引，事务内原子写入
- **可迁移** — 数据可随时通过导入 / 导出功能备份为 JSON

## 功能

- **实时同步** — 操作即时生效，3 秒防抖自动写入数据库；字段级合并（拉取-合并-推送），多设备各改各的互不覆盖
- **首屏 SSR** — 服务端直读数据库渲染书签网格，无骨架屏等待
- **离线可用** — Service Worker 缓存优先，断网也能正常浏览，网络恢复后自动补同步
- **拖拽排序** — 分类与站点支持拖拽重新排序（dnd-kit 懒加载，不拖慢首屏）
- **删除跨设备传播** — 墓碑（tombstone）机制：在一台设备上删除，其他设备同步后也会消失，不会"复活"
- **URL 元数据解析** — 添加站点时自动抓取标题、favicon、描述
- **导入 / 导出** — 书签数据一键备份与恢复

## 快速开始

### 1. 创建 Turso 数据库

在 [Turso](https://turso.tech) 创建数据库，获取 URL 和 auth token。

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

| 变量 | 说明 |
| --- | --- |
| `TURSO_DATABASE_URL` | 必填，数据库连接 URL（如 `libsql://xxx.turso.io`） |
| `TURSO_AUTH_TOKEN` | 必填，数据库访问令牌（服务端专用，切勿提交到仓库） |

> Docker 部署时环境变量在**容器运行时**注入即可，不依赖镜像构建阶段——镜像一次构建、多环境复用。

### 3. 运行

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。

## Docker 部署

```bash
docker pull ghcr.io/wu529778790/navhub.shenzjd.com:main

docker run -d -p 3000:3000 \
  -e TURSO_DATABASE_URL=libsql://xxx.turso.io \
  -e TURSO_AUTH_TOKEN=your_token \
  ghcr.io/wu529778790/navhub.shenzjd.com:main
```

镜像由 GitHub Actions 自动构建并推送到 GHCR（Dockerfile 采用多阶段构建 + Next.js standalone 输出）。

## 数据模型

```text
NavData { version, lastModified, categories[] }
└── Category { id, name, icon?, sort, sites[] }
    └── Site { id, title, url, favicon?, description?, sort? }
```

数据库中规范化为两张表 + 元数据表：

```text
categories { id, name, icon, sort, _deleted, deleted_at, updated_at }
sites      { id, category_id(FK), title, url, favicon, description, sort, ... }
nav_meta   { key, value }  -- version / lastModified / _version
```

## 同步机制

```text
用户操作 → localStorage（即时）→ UI 更新 → 3 秒防抖 → /api/data → Turso 数据库
```

- **localStorage 为即时层**：操作先落本地，秒级响应，再异步同步
- **字段级合并**：同步前先拉取远端，按 `id` 做并集合并、以 `updatedAt` 判定最新版本，两端各自修改的内容都能保留
- **墓碑删除**：删除操作打上 `_deleted` 标记而非物理删除，跨设备同步时删除传播、避免复活
- **冲突防护**：基于指纹识别双方"最后一次同步点之后都改过"的情况，拒绝静默覆盖
- **重试策略**：指数退避自动重试，网络抖动不丢数据
- **SSR 秒开**：RootLayout 服务端直读数据库注入 `initialSites`，首屏 HTML 即含完整书签网格

## 技术栈

- Next.js 16（App Router）+ React 19 + TypeScript（strict）
- Tailwind CSS v4 + shadcn/ui
- @dnd-kit（拖拽排序，React.lazy 懒加载）
- @libsql/client（Turso 数据库驱动）
- Zod（输入校验 + XSS 过滤）
- Vitest（测试）

## 开发

```bash
npm run dev              # 开发服务器（localhost:3000）
npm run build            # 生产构建（next build + 同步 standalone 静态资源）
npm run lint             # ESLint
npm run type-check       # TypeScript 类型检查
npm test -- --run        # 运行测试（vitest，一次性）
npm run format           # Prettier 格式化
```

CI（GitHub Actions）按 `lint → type-check → test → build` 顺序执行，通过后自动构建 Docker 镜像并部署。

## 安全

- **Token 服务端隔离** — Turso token 存于服务端环境变量，前端只通过 `/api/data` 代理读写
- **CSRF 防护** — API 请求经过 Origin 校验；接口带速率限制
- **输入校验** — 用户输入经 Zod 校验与 XSS 过滤
- **安全响应头** — CSP、HSTS、X-Frame-Options 等由中间件统一注入

## License

MIT
