# Next changes

## This update
- [x] Movie/show recommendations based on History favorites, excluding saved titles.
- [x] Pin Playlist items to the top; preserve pins through Gist sync.
- [x] Hide unaired episode summaries and blur stills until explicitly revealed.
- [x] Per-device Show Titles setting for Playlist and History.

## Next: existing feature parity
- [x] Remove games from this webapp: search, filters, settings, details, deals, API hooks, and game-specific copy. Legacy games stay in IndexedDB, Gist sync, and JSON backups (available while connected); only the UI/preferences migrate. Old game links show an unsupported notice.
- [x] Returning shows: remember the episode air date that triggered each return so marking it played cannot return the same episode again; persist and merge this state through Gist. Stale automatic returns yield to another device's play, move, or removal.
- [x] Metadata freshness: refresh ongoing Playlist shows daily and other cached details weekly on launch, foreground, reconnect, and a 15-minute visible-app check. Share a sequential queue with daily History return checks; cap each pass at 30 titles, reuse fresh details, and back off failed/rate-limited requests. Cache ages stay device-local; Gist reads no longer refetch the entire library.
- [x] Actor pages: full, expandable biographies with a six-line preview; curated movie/show filmography (up to 30), rotating six movies/six shows twice then filling by popularity. Filter News/Reality/Talk shows, deduplicate credits, and apply enabled types before capping. Desktop sheets and mobile pages share the behavior.
- [x] Discovery: mix up to six upcoming movies and six upcoming shows (tomorrow through day 30) into Trending, alternating types and inserting one after every four trending titles, then appending the rest. Deduplicate titles, respect enabled types, show premiere countdowns only in discovery, and refresh the date window overnight/on foreground. Partial API failures retain successful sources and offer retry. No games.
- [x] Export a readable text library with Favorites first, then alphabetical Playlist and History sections, including hidden media types and legacy records. Include media type, release year, personal rating, and source ID. Export locally as UTF-8 text while connected or offline; retain JSON backup and report download errors.
- [x] Poster indicators: iOS-style borders without changing card size. Library pins use thick cyan, History favorites pink; search/discovery/recommendations prioritize favorite (pink), Playlist (cyan), History (green), upcoming (amber), then neutral. Keep badges/countdowns and announce saved state accessibly; read live library state so stale results cannot restore removed favorites.
- Not planned: notifications/release reminders. Existing release-date displays and discovery countdowns remain; no notification functionality is needed.

## Future ideas (not part of this update)
- [ ] Evaluate optional Google Drive app-data sync versus account sign-in plus a hosted database.
- [ ] Evaluate optional CloudKit web sync, Apple Developer setup, and Apple Account/iCloud requirements. Keep Gist until an explicit migration is designed.

## Compatibility
- Gist payload version 6 adds TV return air dates (version 5 added pins). Versions 1–5 remain readable; older deployed clients need upgrading before reading v6 libraries. Libraries without return markers begin recording them on their next automatic return.
- Show Titles stays local to this browser/device, matching the iOS per-device preference.
