# 树形导航站 · UI 设计规格 v1

> 配套 Ardot 设计稿 `tree-nav-station-v1.ardot`（fileId: 717339327311546）
> 锁定日期：2026-08-21
> 风格：Vercel / Linear 极简单色调 + 黄色点缀（呼应原站文件夹黄）

---

## 1. 设计 Token

### 1.1 颜色（CSS 变量参考名）

| Token | 值 | 用途 |
|---|---|---|
| `--bg-page` | `#FAFAFA` | 页面主背景 |
| `--bg-card` | `#FFFFFF` | 卡片 / 容器背景 |
| `--bg-hover` | `#F4F4F5` | 行 hover / chip 灰底 |
| `--bg-active` | `#171717` | 树当前节点 / 主操作 |
| `--text-primary` | `#171717` | 标题 / 主文字 |
| `--text-secondary` | `#3F3F46` | 普通文字 |
| `--text-tertiary` | `#71717A` | 描述 / 占位 |
| `--text-muted` | `#A1A1AA` | meta / 数字 / 计数 |
| `--border-default` | `#E5E5E5` | 1px 卡片边线、分割线 |
| `--accent-yellow` | `#FFD400` | 文件夹 / hover 高亮 / 主 chip |

**色板规则**：除强调黄以外只用黑/白/灰三层（最暗到 `#171717`，最浅到 `#FFFFFF`，中间 5 级灰），达到 Vercel 极简"无重彩"质感。

### 1.2 字体

- **Family**：`Inter`（已在工程内自托管可变字体，woff2 27KB）
- **Roles**：

| Role | Weight | Size | Line Height | 字色 |
|---|---|---|---|---|
| **H1 页面大标题** | Bold (700) | 32px | 40px | `--text-primary` |
| **H2 区块标签** | SemiBold (600) | 13px | 20px | `--text-primary` |
| **H3 卡内标题** | SemiBold (600) | 15-18px | 24px | `--text-primary` |
| **Body 默认** | Regular (400) | 14px | 20px | `--text-secondary` |
| **Body 描述** | Regular (400) | 13px | 18px | `--text-tertiary` |
| **Meta/Caption** | Regular (400) | 12-13px | 16px | `--text-muted` |
| **面包屑** | Regular/Medium | 13px | 20px | 三级色（粗 → 细） |
| **Chip 文字** | SemiBold (600) | 11px | 14px | `--text-primary` 或 `--text-tertiary` |
| **品牌 Logo** | Bold (700) | 18px | 24px | `--text-primary` |

### 1.3 间距系统

统一 **4px 基数**：

```
4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64
```

页面标准 padding：

- Header 高度 `64px`，左右 `padding 24px`
- 主区 `padding 32px`，纵向 gap `24px`
- 卡片内 `padding 16px` ~ `20px`
- 树节点行 `height 32px`，左右 padding `8px / 32px`（缩进层级）
- Bento gap `16px`，站点网格 gap `16px`

### 1.4 圆角

| Token | 值 | 用途 |
|---|---|---|
| `--radius-xs` | `4px` | chip、tag |
| `--radius-sm` | `6px` | 按钮、小元素 |
| `--radius-md` | `8px` | 搜索框、Logo、小卡 |
| `--radius-lg` | `12px` | 主卡片（Bento、站点卡） |

无外阴影（Vercel 调性靠边框 + 极轻阴影取代）。

### 1.5 动效

| 行为 | 时长 | 缓动 |
|---|---|---|
| 卡片/行 hover | 120ms | ease-out |
| 树展开/收起 | 200ms | ease-in-out（高度过渡） |
| ⌘K 弹出 | 150ms | cubic-bezier(0.16, 1, 0.3, 1) |
| 侧边抽屉 | 240ms | ease-out |

全局 transition 默认值：`transition: all 120ms ease-out`。

---

## 2. 核心组件规格

### 2.1 Header（64px 高）

```
┌──────────────────────────────────────────┐
│ [Logo]                       [Search ⌘K] │  ← 64px
└──────────────────────────────────────────┘
```

| 部分 | 规格 |
|---|---|
| Logo | 32×32 黑圆角方块 + 文字「储物间」Bold 18px |
| 搜索框 | 420×40，背景 `#FAFAFA`，1px 边框，圆角 8 |
| ⌘K 提示 | 34×24 小胶囊，34×24 圆角 6 灰底白字 |
| Header 背景 | 白 + 底部 1px 边框 |

**响应式**（<1024px）：Logo 居左 / 搜索框全宽 / 隐藏 ⌘K 文字只保留图标。

### 2.2 左侧树节点行（核心）

**节点有 4 种状态**：

| 状态 | 视觉 |
|---|---|
| 默认 | 白底、灰文字 `#3F3F46`、黄文件夹图标 |
| Hover | 背景 `#F4F4F5` |
| 当前（最终高亮） | 黑底白字 + 黄文件夹 |
| 祖先（链路） | 白底 + Bold + 文字 `#171717` |

**结构（整行热区）**：

```
[文件夹图标 / 链接图标] [分类名/站名]                   [计数]
```

- 整行 `height 32px`，`padding 8 / 8`，圆角 6
- 缩进规则：顶级 `paddingLeft 8`，第一层子 `32`，第二层子 `56`……每多一级 +24
- **图标即类型规则**（用户核心要求）：
  - **同一层都是同一种图标**
  - 第 N 层（除最后一层）= 文件夹图标 `fill #FFD400`
  - 最后一层（站点叶子层）= 链接图标（线框 stroke `#71717A`）
- 当前/祖先的图标一律用黄文件夹
- 整行点击展开/折叠**或**跳转到该分类详情（不点击小箭头）

**滚动**：树区域独立滚动，长度不限无分页。

### 2.3 面包屑

三级结构：

```
储物间  /  01 网页  /  综合
(#A1A1AA)  (#A1A1AA)    (#171717 Medium)
```

- 字号 13px，分隔符 `#D4D4D8`
- 任意一级可点击回溯
- 当前级 Medium + 黑，前级 Regular + 灰

### 2.4 全局搜索框（Header 内）

- 宽度 420 / 40 高 / 圆角 8 / 灰底 `#FAFAFA` / 1px 边框
- 内部：搜索 icon + 占位文字「搜索分类或网站…」+ ⌘K 胶囊（推到右侧）
- 触发 ⌘K / Ctrl+K 弹出大搜索面板

### 2.5 Bento 子分类卡片

布局（Bento 大小卡交错）：

| 尺寸 | 宽 × 高 | 用途 |
|---|---|---|
| **大卡** | 720 × 168 | 头部分类，包含 4 个站点预览 chip |
| **小卡** | 360 × 168 | 普通子分类 |

**结构**：

```
[文件夹图标] [分类名 18 Bold]                  [站点数]
[描述 13 灰]
[站点预览 chip] [chip] [chip] [chip]    ← 仅大卡有
```

- 卡片：白底 / 1px 边框 / 圆角 12 / padding 20 / 间距 12
- 站点预览 chip（仅大卡）：`#F4F4F5` 灰底 + favicon 占位 + 12px 站名，高 32
- Hover：边框由 `--border-default` 变 `--accent-yellow`

### 2.6 站点卡片

**4 列网格，每列 262px × 高度 ~144px**（按 1096 主区宽度 + 16 间隔）。

```
[favicon 28×28 圆角 6 黄/灰]  [标题 15 Bold]           ⋯
[描述 13 灰]
[chip] [chip]
```

- 卡片：白底 / 1px 边框 / 圆角 12 / padding 16 / 纵向 gap 10
- Favicon 占位目前用纯色块（28×28 / 圆角 6），黄或灰填充（实际可用真实 favicon URL）
- ⋯ 菜单图标（右上角 20×20 灰色三点）
- Hover：边框变黄、整卡可点击（点击进站点或打开 popup 菜单）

### 2.7 标签 chip

两种样式（已确定）：

| 类型 | 样式 | 用途 |
|---|---|---|
| **黄色实心** | `#FFD400` 背景 + 11px SemiBold 黑字 | 关键标识（"官方直解"） |
| **灰色描底** | `#F4F4F5` 背景 + 11px Medium 灰字 | 次要标识（"备用链接"、"无广告"、"通用"） |

- 高 22px / padding 8 / 圆角 4
- 边框无

### 2.8 三点菜单（⋯）

20×20 圆点（垂直三点）。Hover 才显示。点击下拉（不在本次设计稿中）。

### 2.9 排序按钮

```
┌─────────────────────────────┐
│  按添加时间 ↓               │  ← 32 高 / 白底 / 边框 / 圆角 6
└─────────────────────────────┘
```

---

## 3. 页面模板规格

### 3.1 主页（顶级 14 分类入口）

布局：

| 区 | 尺寸 | 内容 |
|---|---|---|
| Header | 全宽 64 | 同 §2.1 |
| 左侧树 | 280 全高 | 14 个顶级分类树，可滚动 |
| 主区 | `flex 1` | 面包屑 / 标题 / 子分类 Bento |

**主区从根节点看**：
- 大标题：分类名（如 `01 网页`）32px Bold
- Meta：`4 子分类 · 42 站点 · 最后更新 2026-08` 14 灰
- 子分类 Bento 网格（1 大卡 + N 小卡交错排列）

### 3.2 子分类页（展开一个 1 级分类后）

同主页结构，但：
- 树里"01 网页" + "综合"都高亮（祖先 + 当前）
- 面包屑加一级
- Bento 网格展示当前分类下的下一层子分类

### 3.3 站点网格页（最深层）

同 §3.1，但右侧：
- 面包屑加到第三级
- 标题是子分类名（如「综合」）
- Meta：`16 个网站 · 最后更新`
- 右上「按添加时间 ↓」排序按钮
- 主区 = 4 列站点网格（最多 8 卡展示，更多可加分页 / 滚动加载）

---

## 4. 交互状态汇总

| 元素 | 默认 | Hover | Active / 当前 |
|---|---|---|---|
| 树节点行 | 灰文字 + 黄文件夹 | `#F4F4F5` 背景 | 黑底白字 + 黄文件夹 |
| Bento 卡 | 1px 灰边 | 边变黄 | 边变黄 + 整卡下沉 1px |
| 站点卡 | 1px 灰边 | 边变黄 + 显示 ⋯ 菜单 | 边变黄 + ⋯ 高亮 |
| 站点卡 favicon | 实色块 | 轻微变亮 5% | — |
| 搜索框 | 灰底 + 1px 灰边 | 边变黑 | 边变黄 + 微微缩放 |
| Header Logo | 黑方块 + 黑字 | 方块变灰 | — |
| 面包屑任意级 | 灰文字 | 文字变黑 | — |

**键盘快捷键**：

| 键 | 行为 |
|---|---|
| `⌘K` / `Ctrl+K` | 弹出全局搜索面板 |
| `Esc` | 关闭弹窗 / 折叠树 |
| `[` / `]` | 折叠 / 展开当前节点 |
| 上下方向键 | 在树节点间移动 |

---

## 5. 响应式

| 断点 | 宽度 | 布局变化 |
|---|---|---|
| `≥1280` | Desktop | 三区：Header + 280px 树 + 主区 |
| `1024-1279` | Desktop 紧凑 | 树缩为 240px；Bento 改 1 大 + 1 小 |
| `768-1023` | Tablet | 树变为抽屉式（头部按钮唤出）；主区 1 列站点卡 |
| `<768` | Mobile | 抽屉树 + 单列内容；隐藏 Header 搜索框 → 移到顶部全宽 |

**移动端首页差异**（基于用户洞察：原站移动端靠 tree 引导浏览）：

- 顶部全宽搜索框 + 一个「⌄ 树」按钮
- 主区直接是该节点的内容（不显示祖先树）
- 点「⌄ 树」唤出左侧抽屉式多级树

---

## 6. 数据 Schema → 组件字段映射

数据源（用户已有，结构推断自 axutongxue 储物间）：

```typescript
type NavNode = {
  id: string;                  // 唯一 ID
  name: string;                // 分类 / 站名
  parentId: string | null;     // 父分类 ID（null = 顶级）
  level: number;               // 1=顶级, 2=子分类, 3=站点（叶子层）
  type: "category" | "link";   // category=可下拐, link=叶子跳转
  url?: string;                // 站点 URL（仅 type=link）
  description?: string;        // 站点描述
  tags?: string[];             // 站点标签，如 ["官方直解", "备用链接"]
  favicon?: string;            // favicon URL
  children?: NavNode[];        // 子节点（递归）
  order?: number;              // 排序（同级按此升序）
};
```

| 组件字段 | 数据字段 |
|---|---|
| 树节点分类名 | `name` |
| 树节点计数 | `count(children where level=N+1 and type='link')` 或 `count(all descendants of type link)` |
| Bento 卡标题 | `name` |
| Bento 卡描述 | `description`（仅 category 有） |
| Bento 卡站点数 | `count(children of type link)` |
| 站点卡标题 | `name` |
| 站点卡描述 | `description` |
| 站点卡 favicon | `favicon` URL（fallback 纯色块） |
| 站点卡标签 | `tags`（黄色 chip 「官方直解」+ 灰色 chip「备用链接」等） |

---

## 7. 实现提示

### 7.1 推荐技术栈（用户已有 navhub 项目）

- **Next.js 14+ App Router**（如果新建项目）：SSR 直读 Turso 或其他数据库
- **Tailwind v4 CSS-first**（避免 Tailwind 配置文件，主题写在 `globals.css` 的 `@theme inline`）
- **CSS Variables**：`--bg-page` `--text-primary` 等，挂在 `:root`
- **字体**：复用 `next/font/local` 自托管 Inter（27KB woff2 可变字体）

### 7.2 关键交互实现路径

| 功能 | 实现 |
|---|---|
| 树展开/折叠 | React state：`Set<nodeId>` 存展开的 ID；点击行 toggles |
| 自动展开祖先链 | 进入页面时计算 `currentNodeId` 链，加入 expanded Set |
| 当前节点高亮 | 当前节点的 `highlight` prop，对应黑底白字 class |
| ⌘K 搜索 | `command-k.tsx` 组件；监听 `keydown` 全局快捷键；内容居中浮层 |
| 卡片入场动画 | `framer-motion` stagger 0.04s；或 CSS `@keyframes fadeIn` |
| 排序 | URL search params 控制排序字段（`?sort=time_desc`） |

### 7.3 不在本设计稿范围内（建议后续章节）

- 全局搜索弹出面板
- 移动端抽屉树
- 站点卡 hover popup（备用链接、备用资源）
- 内容编辑态
- 主题切换（用户已确认单浅色）
- 登录 / 同步（用户已确认只读）

---

## 8. 设计源文件 & 数据占位约定

- 设计稿文件 ID：`717339327311546`
- 设计稿文件名：`树形导航站 UI 设计`
- 占位数据：当前用 axutongxue 储物间的示例（顶级 14 分类，01 网页下 4 子分类，每子分类 6-16 站点）。实际项目接入时请替换为真实数据源的 2757 个站点
- 真实 favicon：建议实现 `/api/favicon?domain=` 代理 + 1 天缓存（参考已有 navhub 项目实现）
