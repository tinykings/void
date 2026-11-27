<p align="center">
  <img src="public/logo.png" alt="Void Logo" width="120" />
</p>

<h1 align="center">VOID</h1>

<h3 align="center">A movie and show tracker hosted on GitHub Pages</h3>

<p align="center">
  <a href="https://void.tinyk.ing/">void.tinyk.ing</a>
</p>

---

<!-- Screenshot -->
<!--
<p align="center">
  <img src="docs/screenshot.png" alt="VOID App Screenshot" width="800" />
</p>
-->

## Overview

VOID is a personal media tracker built as a static Next.js app deployed to GitHub Pages. Track your playlist and history for movies and TV shows, keep your collection local, and browse TMDB metadata from the browser.

Your library is cached in your browser (IndexedDB) and synced through your private GitHub Gist.

## Features

### Core Tracking
- **Playlist & History** — Add movies and shows to your playlist or move them to history. Items are mutually exclusive between the two lists.
- **Pin to Top** — Pin Playlist items from their details; newest pins appear first and sync through Gist.
- **TV Show Auto-Migration** — Shows in your history automatically move back to the playlist when a new episode airs within 7 days, once per episode air date. Marking it played preserves that date through Gist sync, so the same episode cannot bring it back again. Ended or canceled shows are excluded.

- **Metadata Freshness** — Ongoing Playlist shows refresh daily; other details refresh weekly. Launching, returning to the app, and reconnecting check for stale data, with a 15-minute check while visible. Daily History return checks reuse recent details. Requests run sequentially in batches of up to 30 with failure backoff; Gist sync retains fresh local metadata instead of re-fetching every title. Cache ages stay on this device.

### Discovery
- **Search** — Search TMDB movies and TV shows.
- **Recommendations** — Open Recommendations from the filter menu for movie/show suggestions based on History favorites. Saved titles are excluded; each suggestion names its source favorite.
- **Trending & Upcoming** — Browse weekly trending movies/shows mixed with up to six upcoming releases of each type, arriving tomorrow through the next 30 days. Upcoming premieres get amber countdowns; regular search results stay unchanged. Failed sources can be retried without discarding successful ones.
- **Media Details** — Full detail pages with cast, trailers, watch providers, season/episode info, content ratings, and next episode data.
- **Actor Pages** — Expand full biographies from a six-line preview. Browse up to 30 curated movie/show credits, alternating six of each before filling by popularity, excluding News/Reality/Talk shows.

### Streaming Integration
- **Watch Providers** — Click provider icons to open JustWatch search results for that title.

### App Experience
- **Episode Spoiler Protection** — Unaired or undated episode summaries are scrambled and stills blurred until you choose Reveal spoilers; you can hide them again.
- **Poster Indicators** — Library pins have thick cyan borders; History favorites are pink. Search/discovery/recommendations prioritize pink Favorites, cyan Playlist, green History, then amber upcoming releases. Badges and accessible saved-state labels remain available alongside the colors.
- **Poster Grid** — Playlist and History use poster-only cards. Search and Recommendations always show titles.
- **PWA** — Installable as a standalone app on mobile and desktop.
- **Offline Support** — Works offline with cached data via service worker.
- **Responsive** — Mobile-first grid layout (2–6 columns depending on screen size).
- **Animated** — Smooth view transitions via Framer Motion.

See [TODO.md](TODO.md) for follow-up feature parity. Games are no longer displayed or fetched. Existing game records are retained in IndexedDB, Gist sync, and the full JSON backup in Settings; legacy games-only preferences are reset to movies and shows. Old game links display an unsupported notice without fetching metadata. Gist payload v6 adds returning-show air dates (v5 added pins) and reads v1–v5 libraries; older deployed web clients must be updated before reading v6 libraries. Existing libraries start recording return dates on their next automatic return.

## Setup

### Requirements
- A TMDB Read Access Token set in `NEXT_PUBLIC_TMDB_READ_ACCESS_TOKEN`
- Shared OAuth Worker URL set in repository variable `GIST_AUTH_URL`

### Quick Start
1. Open the app at [void.tinyk.ing](https://void.tinyk.ing/)
2. Connect GitHub and authorize Gist access
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
│   ├── types.ts          # Core TypeScript interfaces
├── context/
    └── AppContext.tsx     # React context wrapper around Zustand store
```

**Data flow:** Components → `useAppContext()` → Zustand store → persisted to IndexedDB (`void_user_state`) and synced through `void-data.json` in GitHub Gists. TMDB is called directly for movies/shows. Legacy game records are preserved but never fetched or displayed.

## Development

```bash
npm install
npm run dev      # Start dev server at localhost:3000
npm run build    # Production static export to out/
npm run lint     # Run ESLint
```

GitHub connection is bypassed by default under `npm run dev`; local changes remain in IndexedDB and Gist writes are skipped. To test OAuth locally, set both values in `.env.local`:

```env
GIST_AUTH_URL=https://your-shared-oauth-worker.example
NEXT_PUBLIC_REQUIRE_GITHUB_IN_DEV=true
```

OAuth testing also requires `http://localhost:3000` in the shared Worker's origin allowlist.

## Deployment

GitHub Actions builds and deploys to GitHub Pages on every push to `main`. The static export is served at `https://void.tinyk.ing/`, with an empty `NEXT_PUBLIC_BASE_PATH` for the custom domain.

## Settings Reference

| Setting | Description |
|---|---|
| GitHub Connection | Required Gist OAuth connection for app access and sync |
| Local Cache | Playlist, history, and favorites cached in IndexedDB |
| Watch Providers | Open JustWatch search from provider icons |
| Text Export | Download `void-library.txt` with Favorites first, then alphabetical Playlist/History; includes hidden types, years, personal ratings, and source IDs. Works locally/offline; text is a readable report, not a restore format. |
| JSON Backup | Download the full library, including hidden legacy records, with or without Gist connected |

## License

MIT
