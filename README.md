<p align="center">
  <img src="public/logo.png" alt="Void Logo" width="120" />
</p>

<h1 align="center">VOID</h1>

<h3 align="center">A movie, show, and game tracker hosted on GitHub Pages</h3>

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

VOID is a personal media tracker built as a static Next.js app deployed to GitHub Pages. Track your playlist and history for movies, TV shows, and games, keep your collection local, and browse TMDB metadata from the browser with game metadata provided by an IGDB-backed Cloudflare Worker.

Data lives entirely in your browser (IndexedDB).

## Features

### Core Tracking
- **Playlist & History** — Add movies, shows, and games to your playlist or move them to history. Items are mutually exclusive between the two lists.
- **TV Show Auto-Migration** — Shows in your history automatically move back to the playlist when a new episode airs within 7 days. Ended or canceled shows are excluded.
- **Ratings** — Rate history content 1–5 stars, synced bidirectionally with TMDB where supported.

### Discovery
- **Search** — Real-time search across TMDB movies and TV shows, plus IGDB games.
- **Trending** — Browse weekly trending content from TMDB when opening search.
- **Media Details** — Full detail pages with cast, trailers, watch providers, season/episode info, content ratings, and next episode data.

### Streaming Integration
- **Watch Providers** — Click provider icons to open JustWatch search results for that title.

### App Experience
- **PWA** — Installable as a standalone app on mobile and desktop.
- **Offline Support** — Works offline with cached data via service worker.
- **Responsive** — Mobile-first grid layout (2–6 columns depending on screen size).
- **Animated** — Smooth view transitions via Framer Motion.

## Setup

### Requirements
- A TMDB Read Access Token set in `NEXT_PUBLIC_TMDB_READ_ACCESS_TOKEN`
- A Cloudflare Worker URL set in `NEXT_PUBLIC_GAME_API_BASE_URL` for game lookup
- Twitch/IGDB credentials stored as Cloudflare Worker secrets: `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET`

### Quick Start
1. Open the app at [tinykings.github.io/void](https://tinykings.github.io/void/)
2. Browse and use provider links directly from the details page

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, static export) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 |
| Animations | Framer Motion |
| State | Zustand 5 |
| Persistence | IndexedDB via `idb-keyval` |
| Data | TMDB API v3/v4, IGDB API via Cloudflare Worker |
| Hosting | GitHub Pages |
| Game API | Cloudflare Workers |

## Architecture

```
src/
├── app/                  # Next.js App Router pages
│   ├── page.tsx          # Home page (playlist/history/search)
│   ├── details/          # Media detail page
│   └── ...               # Other routes
├── components/
│   ├── views/            # Page-level views (HomeView, SettingsView)
│   └── ...               # Shared UI components
├── store/
│   └── useStore.ts       # Zustand store — all app state and local persistence
├── lib/
│   ├── tmdb.ts           # TMDB API calls
│   ├── igdb.ts           # Game API Worker client
│   ├── types.ts          # Core TypeScript interfaces
├── context/
    └── AppContext.tsx     # React context wrapper around Zustand store
├── worker/
    └── src/index.ts       # Cloudflare Worker proxy for IGDB
```

**Data flow:** Components → `useAppContext()` → Zustand store → persisted to IndexedDB (`void_user_state`). TMDB is called directly for movies/shows; games are fetched through the IGDB Worker.

## Development

```bash
npm install
npm run dev      # Start dev server at localhost:3000
npm run worker:dev  # Start game API Worker at localhost:8787
npm run build    # Production static export to out/
npm run lint     # Run ESLint
```

For local game search, copy `worker/.dev.vars.example` to `worker/.dev.vars`, fill in the Twitch/IGDB credentials, and set `NEXT_PUBLIC_GAME_API_BASE_URL=http://localhost:8787` in `.env.local`.

## Deployment

GitHub Actions builds and deploys to GitHub Pages on every push to `main`. The static export is served from the project path at `https://tinykings.github.io/void/`.

## Settings Reference

| Setting | Description |
|---|---|
| Local Collection | Playlist, history, and favorites stored in IndexedDB |
| Watch Providers | Open JustWatch search from provider icons |

## License

MIT
