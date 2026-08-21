# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal navigation/bookmarks site ("NavHub") built with Next.js 16 App Router, React 19, and Tailwind CSS v4. Users manage categorized bookmarks that sync bidirectionally with a **Turso (libsql) database** (`categories` / `sites` / `nav_meta` tables). Since 2026-08-21 it is **private-site mode**: no GitHub OAuth, no guest mode — visit and edit directly. Supports offline via service worker, drag-and-drop reordering, and SSR first paint (RootLayout reads the DB server-side).

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

Single test: `npx vitest run src/lib/errors.test.ts`
Run all tests once (non-watch): `npm test -- --run`

Test setup lives in `src/test/setup.ts` (configured in `vitest.config.ts`). Coverage excludes `src/test/`, `node_modules/`, `*.d.ts`, and config files.

## Architecture

### Data Flow

```
User action → localStorage (instant) → UI update → 3s debounce → /api/data → Turso database
```

- **localStorage** (`src/lib/storage/local-storage.ts`): Instant client-side layer, key `nav_data`
- **Sync engine** (`src/lib/storage/sync-manager.ts`): Bidirectional sync with fingerprint-based conflict detection (rejects silent overwrite when both sides changed since last sync), 3s debounce, exponential backoff retry
- **DB client** (`src/lib/server/turso.ts`): Server-side Turso client; `readNavData()` / `writeNavData()` (transactional full-snapshot write into normalized tables)
- **Server proxy** (`src/app/api/data/route.ts`): Reads/writes Turso; no auth (private-site mode)

### Data Model

`NavData { version, lastModified, categories[] }` → `Category { id, name, icon?, sort, sites[] }` → `Site { id, title, url, favicon?, description?, sort? }`

### Key Directories

- `src/app/` — App Router pages and API routes (`/api/data`, `/api/url/parse`, `/api/favicon`, `/api/runtime-config`)
- `src/components/ui/` — shadcn/ui primitives (Radix-based: button, dialog, input, alert-dialog, toast)
- `src/components/layout/` — AppHeader, AppLayout, BottomNav, Container, PageContainer
- `src/contexts/SitesContext.tsx` — Single context for all categories/sites CRUD, sync state, guest mode
- `src/lib/storage/` — localStorage, DB storage, sync manager
- `src/lib/server/turso.ts` — Turso (libsql) database layer (server-only)
- `src/lib/validation.ts` — Zod schemas + XSS sanitization for all user inputs
- `src/lib/security.ts` — Rate limiting, origin validation, CSRF protection
- `src/lib/runtime-policies.ts` — CSP header builder (called from middleware)
- `src/lib/services/url-parser.ts` — URL metadata extraction (title, favicon, description)
- `src/lib/utils/import-export.ts` — Import/export bookmarks logic
- `src/data/sites.json` — Default seed data (fallback when DB not configured)

### Middleware & Security Headers

Middleware lives at `src/middleware.ts` (not root-level). It sets CSP, HSTS, X-Frame-Options, Referrer-Policy, and Permissions-Policy on all non-static responses. CSP is dynamically built via `buildContentSecurityPolicy()` from `src/lib/runtime-policies.ts`.

### Auth Flow

Private-site mode (since 2026-08-21): no auth. `AuthContext` is always authenticated (`isAuthenticated=true`, `isGuestMode=false`, `authUser=null`). All GitHub OAuth routes, server-side GitHub client, and fork logic have been removed.

### Deployment

Build uses Next.js standalone output (`output: "standalone"` in `next.config.ts`). The `npm run build` script runs `scripts/sync-standalone-assets.mjs` after `next build` to copy static assets into the standalone directory. Docker image (`Dockerfile`) uses multi-stage build and runs `node server.js` directly.

### Patterns

- **State**: Single React Context (`SitesContext`), accessed via `useSites()` hook. No external state library.
- **Styling**: Tailwind CSS v4 with CSS-based config (no `tailwind.config.js`). CSS custom properties in `globals.css` define color palette, dark mode via `prefers-color-scheme`.
- **Components**: shadcn/ui pattern with `cn()` utility (clsx + tailwind-merge). Lazy-loaded heavy components (`SortableSites`, `AddCategoryDialog`).
- **Drag & drop**: `@dnd-kit` (core, sortable, utilities) for sortable categories and sites.
- **Storage**: Turso (libsql) via `src/lib/server/turso.ts` — normalized tables, transactional writes. No auth (private site).
- **Offline**: Service worker (`public/sw.js`) with cache-first strategy for GET requests.
- **Validation**: Zod v4 schemas for URLs, titles, category names. XSS pattern detection in validation layer.

## Conventions

- TypeScript strict mode; use `@/*` import alias for `src/*`
- PascalCase component files, kebab-case utility/hook files
- Tests colocated as `*.test.ts` near source
- Prettier: 2 spaces, double quotes, semicolons, 100 char width
- Commit format: `type(scope): description` (e.g. `feat(sync): improve URL metadata fallback`)

## Environment Variables

Copy `.env.example` to `.env.local`:
- `TURSO_DATABASE_URL` (required, server-only) — Turso database URL (e.g. `libsql://xxx.turso.io`)
- `TURSO_AUTH_TOKEN` (required, server-only) — Turso auth token (keep secret, never commit)

`NEXT_PUBLIC_GITHUB_OWNER` / `NEXT_PUBLIC_GITHUB_REPO` are optional and only used for the header GitHub link display.

## Related Files

- `AGENTS.md` — Additional repository guidelines for AI agents
- `README.md` — User-facing documentation with setup instructions and Docker deployment
