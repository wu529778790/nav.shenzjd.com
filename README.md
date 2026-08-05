# NavHub · 导航站

> 一个简单的导航 / 书签管理网站。书签数据存放在**你自己的 GitHub 仓库**里——登录后自动同步，断网也能用，支持拖拽排序，数据随时可 clone、可迁移。

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js) ![React](https://img.shields.io/badge/React-19-61dafb?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript) ![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss) ![License](https://img.shields.io/badge/License-MIT-green) ![CI](https://img.shields.io/github/actions/workflow/status/wu529778790/navhub.shenzjd.com/docker.yml)

## 为什么把数据放在你自己的 GitHub 仓库？

传统导航站把数据存在服务商数据库里，换产品 / 关服务，数据就没了。NavHub 反其道而行：把 `data/sites.json` 存在**你自己的 GitHub 仓库**里。

- **数据是自己的** — 书签就是一份普通 JSON + 完整 Git 历史，随时 clone、审计、迁移到任何地方
- **私有可控** — 登录后自动 Fork 一个仓库，数据不经任何第三方数据库
- **可回溯** — 每一次同步都是一次 Git 提交，误删可恢复，冲突不丢失

## 功能

- **双向同步** — 操作即时生效，3 秒防抖自动同步到 GitHub；采用字段级合并（拉取-合并-推送），多设备各改各的互不覆盖
- **GitHub OAuth** — 登录授权后自动 Fork 仓库，数据私有可控；未登录可浏览示例数据（只读访客模式）
- **离线可用** — Service Worker 缓存优先，断网也能正常浏览，网络恢复后自动补同步
- **拖拽排序** — 分类与站点支持拖拽重新排序（dnd-kit 懒加载，不拖慢首屏）
- **删除跨设备传播** — 墓碑（tombstone）机制：在一台设备上删除，其他设备同步后也会消失，不会"复活"
- **URL 元数据解析** — 添加站点时自动抓取标题、favicon、描述
- **导入 / 导出** — 书签数据一键备份与恢复

## 快速开始

### 1. 创建 GitHub OAuth App

在 [GitHub Developer Settings](https://github.com/settings/developers) 创建 OAuth App：

- **Homepage URL**: `http://localhost:3000`
- **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入 OAuth App 的 Client ID 和 Client Secret。

| 变量 | 说明 |
| --- | --- |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | 必填，OAuth App 的 Client ID（本地开发直接读取；Docker 部署走运行时配置接口下发） |
| `GITHUB_CLIENT_SECRET` | 必填，服务端专用，OAuth App 的 Client Secret |
| `NEXT_PUBLIC_GITHUB_OWNER` | 可选，覆盖默认书签数据仓库 owner |
| `NEXT_PUBLIC_GITHUB_REPO` | 可选，覆盖默认书签数据仓库名 |
| `NEXT_PUBLIC_DATA_FILE_PATH` | 可选，覆盖默认数据文件路径（默认 `data/sites.json`） |

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
  -e NEXT_PUBLIC_GITHUB_CLIENT_ID=your_id \
  -e GITHUB_CLIENT_SECRET=your_secret \
  ghcr.io/wu529778790/navhub.shenzjd.com:main
```

镜像由 GitHub Actions 自动构建并推送到 GHCR（Dockerfile 采用多阶段构建 + Next.js standalone 输出）。

## 数据模型

```text
NavData { version, lastModified, categories[] }
└── Category { id, name, icon?, sort, sites[] }
    └── Site { id, title, url, favicon?, description?, sort? }
```

## 同步机制

```text
用户操作 → localStorage（即时）→ UI 更新 → 3 秒防抖 → /api/github/data → GitHub API → sites.json
```

- **localStorage 为主存储**：操作先落本地，秒级响应，再异步同步
- **字段级合并**：同步前先拉取远端，按 `id` 做并集合并、以 `updatedAt` 判定最新版本，两端各自修改的内容都能保留
- **墓碑删除**：删除操作打上 `_deleted` 标记而非物理删除，跨设备同步时删除传播、避免复活
- **冲突防护**：基于指纹识别双方"最后一次同步点之后都改过"的情况，拒绝静默覆盖
- **重试策略**：指数退避自动重试，网络抖动不丢数据

## 技术栈

- Next.js 16（App Router）+ React 19 + TypeScript（strict）
- Tailwind CSS v4 + shadcn/ui
- @dnd-kit（拖拽排序，React.lazy 懒加载）
- Zod（输入校验 + XSS 过滤）
- Octokit（GitHub REST API）
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

- **Token 服务端隔离** — GitHub Token 存于服务端 HttpOnly Cookie，前端不接触明文
- **CSRF 防护** — API 请求经过 Origin 校验；接口带速率限制
- **输入校验** — 用户输入经 Zod 校验与 XSS 过滤
- **安全响应头** — CSP、HSTS、X-Frame-Options 等由中间件统一注入

## 数据存储

数据存储在你自己的 GitHub 仓库中：

```text
your_username/navhub.shenzjd.com
└── data/
    └── sites.json
```

## License

MIT
