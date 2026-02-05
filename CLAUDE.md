# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm run dev` — Start dev server (localhost:3000)
- `npm run build` — Production build (static export to `out/`)
- `npm run lint` — Run ESLint
- No test framework is configured

## Architecture

VOID is a **Next.js 16 App Router** single-page application that tracks movies and TV shows. It statically exports to GitHub Pages (`output: 'export'`, `basePath: '/void'`).

### Tech Stack
- React 19, TypeScript (strict), Tailwind CSS 4, Framer Motion
- Zustand 5 for state management, persisted to IndexedDB via `idb-keyval`
- TMDB API v3 for all media data and account sync
- PWA with service worker (`public/sw.js`)

### Key Directories
- `src/store/useStore.ts` — Zustand store: the central state management file containing all app state, TMDB sync logic, TV show migration logic, and list management
- `src/lib/tmdb.ts` — All TMDB API calls (search, trending, details, auth, watchlist/rated CRUD)
- `src/lib/types.ts` — Core TypeScript interfaces (`Media`, store types)
- `src/context/AppContext.tsx` — React context wrapper around the Zustand store
- `src/components/` — UI components; `views/` subdirectory has page-level views (HomeView, SettingsView)
- `src/app/` — Next.js App Router pages (home + details)

### Data Flow
Components use `useAppContext()` → Zustand store → persisted to IndexedDB (key: `void_user_state`). TMDB sync merges remote watchlist/rated items with local state, enforcing list exclusivity (items cannot be in both watchlist and watched).

### TMDB Sync & TV Migration
- Sync is rate-limited to 30-second cooldowns, triggered on load/focus/manual refresh
- TV shows in the watched list auto-migrate to watchlist if an upcoming episode airs within 7 days
- Background migration checks run every 60 seconds; individual shows re-checked every 24 hours
- Shows with status "Ended" or "Canceled" are excluded from migration

### Path Alias
`@/*` maps to `src/*` (configured in tsconfig.json)

## Deployment
GitHub Actions (`.github/workflows/deploy.yml`) builds and deploys to GitHub Pages on push to main. Uses Node 20 and `npm ci`.

## External Integrations
- **TMDB API** — Requires user-provided API key; OAuth for account sync
- **VidAngel** — Optional content filtering (`src/lib/vidangel.ts`)
- **External players** — URL-template-based launch of streaming sites for movies/episodes
