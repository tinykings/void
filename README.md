<p align="center">
  <img src="public/logo.png" alt="Void Logo" width="120" />
</p>

<h1 align="center">VOID</h1>

<h3 align="center">A movie and TV show tracker hosted on GitHub Pages</h3>

<p align="center">
  <a href="https://tinykings.github.io/void/">tinykings.github.io/void</a>
</p>

---

<!-- Screenshot -->
<!--
<p align="center">
  <img src="docs/screenshot.png" alt="VOID App Screenshot" width="800" />
</p>
-->

## Overview

VOID is a personal media tracker built as a static Next.js app deployed to GitHub Pages. Track your watchlist and watch history for movies and TV shows, sync with your TMDB account, and browse TMDB metadata from the browser with no backend required.

Data lives entirely in your browser (IndexedDB) or within your TMDB profile.

## Features

### Core Tracking
- **Watchlist & History** — Add movies and shows to your watchlist or mark them as watched. Items are mutually exclusive between the two lists.
- **TV Show Auto-Migration** — Shows in your watch history automatically move back to the watchlist when a new episode airs within 7 days. Ended or canceled shows are excluded.
- **Ratings** — Rate watched content 1–5 stars, synced bidirectionally with TMDB.

### Discovery
- **Search** — Real-time search across all TMDB movies and TV shows.
- **Trending** — Browse weekly trending content from TMDB when opening search.
- **Media Details** — Full detail pages with cast, trailers, watch providers, season/episode info, content ratings, and next episode data.

- **TMDB Account Sync** — OAuth login syncs your TMDB watchlist and rated items with local state. Rate-limited to 30-second cooldowns.

### Streaming Integration
- **Watch Providers** — Click provider icons to open JustWatch search results for that title.
- **VidAngel** — Optional content filtering integration. Shows an "Edited" badge and filter toggle when enabled.

### App Experience
- **PWA** — Installable as a standalone app on mobile and desktop.
- **Offline Support** — Works offline with cached data via service worker.
- **Responsive** — Mobile-first grid layout (2–6 columns depending on screen size).
- **Animated** — Smooth view transitions via Framer Motion.

## Setup

### Requirements
- A TMDB Read Access Token set in `NEXT_PUBLIC_TMDB_READ_ACCESS_TOKEN`

### Quick Start
1. Open the app at [tinykings.github.io/void](https://tinykings.github.io/void/)
2. Click **Login with TMDB** to enable account sync
3. Browse and use provider links directly from the details page

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, static export) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 |
| Animations | Framer Motion |
| State | Zustand 5 |
| Persistence | IndexedDB via `idb-keyval` |
| Data | TMDB API v3/v4 |
| Hosting | GitHub Pages |

## Architecture

```
src/
├── app/                  # Next.js App Router pages
│   ├── page.tsx          # Home page (watchlist/history/search)
│   ├── details/          # Media detail page
│   └── ...               # Other routes
├── components/
│   ├── views/            # Page-level views (HomeView, SettingsView)
│   └── ...               # Shared UI components
├── store/
│   └── useStore.ts       # Zustand store — all app state, sync logic, TV migration
├── lib/
│   ├── tmdb.ts           # All TMDB API calls
│   ├── types.ts          # Core TypeScript interfaces
│   └── vidangel.ts       # VidAngel integration
└── context/
    └── AppContext.tsx     # React context wrapper around Zustand store
```

**Data flow:** Components → `useAppContext()` → Zustand store → persisted to IndexedDB (`void_user_state`). TMDB sync merges remote watchlist/rated items with local state.

## Development

```bash
npm install
npm run dev      # Start dev server at localhost:3000
npm run build    # Production static export to out/
npm run lint     # Run ESLint
```

## Deployment

GitHub Actions builds and deploys to GitHub Pages on every push to `main`. The static export is served from the `/void/` basePath.

## Settings Reference

| Setting | Description |
|---|---|
| TMDB Login | OAuth sync with your TMDB account |
| Watch Providers | Open JustWatch search from provider icons |
| VidAngel | Enable content filtering badges and filter |

## License

MIT
