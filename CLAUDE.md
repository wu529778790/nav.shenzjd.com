# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A **pure read-only** personal navigation/bookmarks site ("NavHub") built with Next.js 16 App Router, React 19, and Tailwind CSS v4. Bookmarks are organized as a **tree** of categories sourced from 阿虚同学的储物间 (axutongxue) and served from a **Turso (libsql) database**. There is **no login, no editing, no deletion, and no client-side sync** — the data is maintained entirely by external `navdata` tooling and imported into Turso via scripts. The UI is a Vercel/Linear-style minimal monochrome design.

## Commands

```bash
npm run dev                      # Dev server on localhost:3000
npm run build                    # Production build (next build + sync standalone assets)
npm run start                    # Run production build locally (node server.js)
npm run lint / npm run lint:fix  # ESLint (Next.js + TS rules)
npm run format / npm run format:check  # Prettier on src/**/*
npm run type-check               # tsc --noEmit (strict mode)
npm test                         # Vitest (jsdom, globals; runs in watch mode)
npm run test:ui                  # Vitest with browser UI
npm run test:coverage            # Vitest with v8 coverage
```

Single test: `npx vitest run src/lib/favicon-url.test.ts`
Run all tests once (non-watch): `npm test -- --run`

Test setup lives in `src/test/setup.ts` (configured in `vitest.config.ts`). Coverage excludes `src/test/`, `node_modules/`, `*.d.ts`, and config files.

## Architecture

### Data Flow (read-only)

```text
page.tsx (SSR) → readNavData() reads Turso → filters tombstones → injects initialCategories → HomeClient
```

- Data flows in one direction: server reads → SSR injects → client renders. There is **no localStorage and no client write path**.
- `src/lib/server/turso.ts` is the server-only DB layer: three tables `categories` / `sites` / `nav_meta`. `categories` uses a self-referencing `parent_id` to form an arbitrary-depth tree (current data is 5 levels deep, 14 top-level categories, ~2757 sites). `readNavData()` assembles the recursive tree; `writeNavData()` flattens and writes transactionally (used by import scripts only).
- `src/app/page.tsx` reads the DB server-side and SSR-injects the tree into `HomeClient`. No `/api/data` frontend interface exists.

### Key Directories

- `src/app/` — App Router pages and API routes (`/api/favicon`, `/api/sites/[siteId]/dead-report`, `/api/sites/dead-report-state`). `layout.tsx` (self-hosted font + ErrorBoundary), `page.tsx` (SSR), `globals.css` (theme), `robots.ts`, `sitemap.ts` (uses the `src/data/sites.json` seed). Pages are ISR (`revalidate = 21600`); report state is client-fetched so HTML has no per-anon dependency.
- `src/components/layout/` — `AppHeader` (logo + global search with `⌘K`), `AppLayout`.
- `src/components/HomePage/` — `Sidebar` (recursive tree; collapsed by default, whole-row clickable, folder icon = category, link icon = leaf site), `HomeClient` (assembles header + sidebar + main: breadcrumb, Bento subcategory grid, static site board, global search), `StaticBoard` (`StaticSiteCard`: favicon + title + "备用链接" chip for `description === "备用地址"`), `BentoGrid` (`BentoSubCategoryGrid`: uniform folder cards).
- `src/components/FaviconImage.tsx` — favicon with proxy fallback.
- `src/components/ErrorBoundary.tsx` — catch render errors (defensive only; no external consumers).
- `src/lib/server/turso.ts` — Turso (libsql) data layer (server-only).
- `src/lib/runtime-policies.ts` — CSP header builder (called from proxy).
- `src/lib/favicon-url.ts`, `src/lib/server/safe-external-fetch.ts` — favicon proxy helpers.
- `src/lib/utils.ts` — `cn()` (clsx + tailwind-merge).
- `src/data/sites.json` — committed seed fallback (used by sitemap; runtime data is in Turso).
- `scripts/` — `import-axutongxue.mjs` (axutongxue → Turso tree import), `reset-tables.mjs` (rebuild tables), `sync-standalone-assets.mjs` (run after build), `submit-sitemap.mjs` (CI sitemap submission).

### Proxy & Security Headers

Proxy lives at `src/proxy.ts` (Next 16 convention, was `middleware.ts`; not root-level). It sets CSP, HSTS, X-Frame-Options, Referrer-Policy, and Permissions-Policy on all non-static responses. CSP is dynamically built via `buildContentSecurityPolicy()` from `src/lib/runtime-policies.ts`.

### Deployment

Build uses Next.js standalone output (`output: "standalone"` in `next.config.ts`). The `npm run build` script runs `scripts/sync-standalone-assets.mjs` after `next build` to copy static assets into the standalone directory. Docker image (`Dockerfile`) uses multi-stage build and runs `node server.js`. CI deploys via SSH to the production server.

### Styling

- Tailwind CSS v4 with CSS-based config (no `tailwind.config.js`). Theme is CSS-only via `@theme inline` in `src/app/globals.css`. Colors use CSS custom properties (`var(--foreground)`, `var(--background)`, `var(--accent-500)`, etc.), not Tailwind color classes.
- Light + dark themes: `<html data-theme>` drives `[data-theme="dark"]` overrides in globals.css. Applied before hydration by an inline script in `src/app/layout.tsx` (localStorage `theme` wins, defaults to system `prefers-color-scheme`), toggled by `src/components/ThemeToggle.tsx`. Always reference CSS variables so both themes work.
- Component classes are defined in `globals.css` (`@layer components`): `.card`, `.site-card`, `.input`, `.empty-state`, etc. — use these, don't recreate them.
- `cn()` utility (clsx + tailwind-merge) in `src/lib/utils.ts`.

## Conventions

- TypeScript strict mode; use `@/*` import alias for `src/*`.
- PascalCase component files, kebab-case utility/hook files.
- Tests colocated as `*.test.ts` / `*.test.tsx` near source.
- Prettier: double quotes, semicolons, 100 char width, trailing commas es5.
- Commit format: `type(scope): description` (e.g. `feat(tree): collapse sidebar by default`).

## Environment Variables

Copy `.env.example` to `.env`:
- `TURSO_DATABASE_URL` (required, server-only) — Turso database URL (e.g. `libsql://xxx.turso.io`)
- `TURSO_AUTH_TOKEN` (required, server-only) — Turso auth token (keep secret, never commit)

## Related Files

- `AGENTS.md` — Compact repository guidelines for AI agents
- `README.md` — User-facing documentation with setup instructions and Docker deployment
