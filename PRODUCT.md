# Product

## Register

product

## Users

People who track movies, TV shows, and games across a playlist and history. Mobile-first audience using the app as a PWA. Privacy-conscious: no signup, data lives entirely in the browser.

## Product Purpose

A personal media tracker for movies, TV shows, and games. Playlist management, history, ratings, and streaming provider discovery for video. No backend, no signup — data lives in IndexedDB. Offline-capable PWA deployed as a static site.

## Brand Personality

Moody · Precise · Technical. Dark ground, cyan accent, compact information density. The interface feels like a tool, not a social feed. Lean into the "void" — empty space as a design material, not a placeholder.

## Anti-references

- Over-designed streaming service UIs (Netflix, Hulu — too busy, too much chrome)
- Social-heavy apps that optimize for engagement over utility
- Anything that feels like a spreadsheet or admin dashboard

## Design Principles

1. **Stay out of the way.** The movies and TV shows are the content. Chrome recedes. No decorative fluff, no redundant labels, no hero-metric templates. Every pixel either carries data or creates space.

2. **Moody atmosphere, not dark mode.** Dark is the material, not the gimmick. Use depth, elevation, and cyan glow to create a sense of space. Not "dark mode" — dark as the starting point.

3. **Precision over polish.** UI is compact, information-dense, and responsive. Every state is accounted for — loading, empty, error, edge. No animations that slow the user down.

4. **No backend, no excuses.** The app must feel fast and complete despite running entirely in the browser. Offline is the default, not a fallback.

## Accessibility & Inclusion

Standard web best practices: semantic HTML, keyboard navigation, reasonable color contrast. No specific WCAG level target, but no barriers either. Reduced motion respected via `prefers-reduced-motion`.
