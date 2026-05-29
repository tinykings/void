---
target: main app surface (home page + views)
total_score: 31
p0_count: 0
p1_count: 2
p2_count: 2
timestamp: 2026-05-29T00-48-01Z
slug: src-app-page-tsx
---
#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading skeletons present but no total count for infinite-scroll grids |
| 2 | Match System / Real World | 4 | Familiar media-tracking terminology throughout |
| 3 | User Control and Freedom | 3 | Confirmation on destructive actions; no undo for add/remove |
| 4 | Consistency and Standards | 4 | Uniform component vocabulary across all screens |
| 5 | Error Prevention | 3 | Destructive-action confirmation; no autosave on sheet close |
| 6 | Recognition Rather Than Recall | 3 | Search with debounce + trending; Settings hidden behind gear icon |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts, no bulk actions, no batch editing |
| 8 | Aesthetic and Minimalist Design | 4 | Strong identity, every element earns its place |
| 9 | Error Recovery | 3 | API errors caught; stream failures show count but no details |
| 10 | Help and Documentation | 2 | No onboarding, no help section, no tooltips |
| **Total** | | **31/40** | **Good** |

#### Anti-Patterns Verdict

**Does this look AI-generated?** No. Void has a strong, coherent design voice. The blueprint borders, caps-only convention, cyan-is-signal color philosophy, and glass-layered sheets are intentional choices that carry through every component. This passes the AI slop test.

**Deterministic scan**: Not available. The bundled detector (`detect-antipatterns.mjs`) is not installed in this skill deployment.

**Visual overlays**: Not available. No browser automation tool is accessible in this session.

#### Overall Impression

Void is confidently designed. The surveillance-room aesthetic — dark ground, thin blueprint borders, cyan as the single interaction signal — is distinctive and well-executed. The sheet-based navigation feels native on mobile, and the state handling (loading skeletons, empty states, error fallbacks) is thorough for an indie app. The two biggest opportunities are: (1) adding keyboard shortcuts and power-user accelerators to match the tool-like personality, and (2) addressing the hidden-scrollbar and contrast hierarchy issues.

#### What's Working

1. **Coherent design language.** The blueprint border + void ground + cyan accent triad appears identically in cards, sheets, inputs, and the bottom bar. This consistency makes the app feel like a crafted product, not a template.

2. **Mobile-first sheet architecture.** Sheets for details, search, cast, and settings with slide-up animation and embossed edge treatment provide a native-feeling navigation layer. One sheet at a time, no stacking, clean exit paths.

3. **Comprehensive async states.** Every data-fetching component renders loading skeletons (pulse placeholders at the correct aspect ratio), empty states with actionable guidance, and error fallbacks. This is rare in indie apps and shows a production mindset.

#### Priority Issues

- **[P1] Hidden scrollbars.** `globals.css:60-70` hides all scrollbars with `::-webkit-scrollbar { display: none }` and `scrollbar-width: none`. Users cannot tell if a panel is scrollable without attempting to scroll. On desktop, this is confusing; on mobile, it's slightly more tolerable but still a violation of visibility of system status.

- **[P1] No keyboard shortcuts.** The app has zero keyboard navigation — no Esc to close sheets (sheets are closed via dedicated buttons only), no arrow key navigation in grids, no shortcuts for common actions (search=Cmd+K, add to watchlist, etc.). For a "Precise · Technical" tool, this is a notable gap. Power users will need to reach for the mouse/touch for every action.

- **[P2] Flat dark hierarchy.** Despite the glass layering philosophy, most surfaces use values close to `#0F1115` (`brand-bg`, `brand-bg/80`, `brand-bg/95`, `brand-bg/75`). The distinction between these is barely perceptible. A second neutral surface color (slightly lighter, e.g., `oklch(18% 0.005 260)`) would improve depth perception without violating the void aesthetic.

- **[P2] No undo for non-destructive actions.** Adding to watchlist or marking as watched triggers an immediate state change with a pulse animation but no toast-based undo. The confirmation modal only appears for removals. A "Added to watchlist" toast with an Undo button would prevent regret-driven re-opens.

- **[P3] Settings discoverability.** Sync configuration (Gist ID/token) and backup export/import are accessed through: filter menu (leftmost bottom bar button) → gear icon in the filter popover → modal. This is three taps deep for core data management. Settings should have a more prominent entry point.

#### Persona Red Flags

**Casey (Distracted Mobile User)**: The bottom-bar navigation puts all primary actions in the thumb zone — good. Sheet-based navigation preserves state on close — good. However, hidden scrollbars mean Casey may not realize a detail sheet has more content below the fold. The bottom bar's floating status badge may overlap with content on devices with large safe areas.

**Alex (Power User)**: Alex will be frustrated immediately. No keyboard shortcuts. No bulk actions (must add/search one item at a time). No way to filter by streaming provider without entering the stream view. The confirmation modal on every removal adds friction. Infinite scroll with no "jump to top" or page controls.

**Riley (Stress Tester)**: TMDB API errors are caught but logged to console.error with no user-facing message in most cases. Stream view failure count is surfaced but the specific failures are opaque. The import backup flow parses JSON with error handling. Edge case: if IndexedDB is full or blocked, there's no error handling visible in the code.

#### Minor Observations

- The `viewport` meta tag sets `maximumScale: 1` and `userScalable: false`, which prevents pinch-zoom. This is an accessibility concern for low-vision users.
- The bottom bar toggle uses a `translate-x-full` animation for the pill indicator. On first render, the pill starts at `translate-x-0` (Library) but the initial active state depends on `showWatched`. If showWatched is true, the pill needs to animate from 0 to full on mount. This may cause a visible jump.
- `aria-live="polite"` on the status badge is good but the status badge is positioned `fixed` and may not be announced by screen readers reliably.
- The search input focus ring uses `ring-1 ring-brand-cyan` which provides a thin 1px ring — this may fail WCAG 2.4.7 focus indicator requirements (minimum 2px thickness).

#### Questions to Consider

- "What would this look like with a second neutral surface color at 18% lightness — enough to distinguish panels from the void, not enough to break the mood?"
- "If you added three keyboard shortcuts (Esc to close sheets, Cmd+K for search, S for Stream view), would the power-user experience match the tool-like design intent?"
- "Does the confirmation modal on removal add safety, or does the lack of undo make every removal feel risky?"
