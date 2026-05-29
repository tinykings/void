---
target: details sheet
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-05-29T01-11-21Z
slug: src-components-detailssheet-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Loading skeletons shown, but API failures produce eternal loading — all 4 fetch paths silently catch with `console.error` (lines 98, 185, 204, 220) |
| 2 | Match System & Real World | 4 | Natural tracker vocabulary (Watched, Watchlist, S1E2 format), familiar external links (IMDb, JustWatch, Common Sense) |
| 3 | User Control & Freedom | 3 | Undo toasts on add, confirmation modal on remove, overlay click to close. Esc key IS handled globally via KeyboardShortcuts. Confirmation modal adds friction on every remove |
| 4 | Consistency & Standards | 3 | Green active state on Watched (emerald-300/40) breaks the single-voice cyan rule from DESIGN.md. Full second color system with its own glow and hover |
| 5 | Error Prevention | 3 | Confirmation before destructive removes, disabled state during pulse animation. No debounce on rapid clicks |
| 6 | Recognition Rather Than Recall | 4 | Every button has text + icon, tabs always visible, metadata in chips, active states are clear |
| 7 | Flexibility & Efficiency | 1 | No sheet-specific keyboard shortcuts (W for Watchlist, E for Watched), no swipe-to-dismiss, no batch operations. Global Esc/Cmd+K exist but don't cover sheet-specific actions |
| 8 | Aesthetic & Minimalist Design | 3 | Mostly clean. Nested embossed edges (sheet + content section) create conflicting elevation. 10 interaction targets in the primary zone before any content loads |
| 9 | Error Recovery | 1 | No user-facing error handling exists. All API errors go to silent `console.error`. User sees infinite skeleton with no explanation or retry |
| 10 | Help & Documentation | 1 | No tooltips, no contextual help. Parental guide and Common Sense links offer zero context. Close button has `title="Tap to close"` but no visible instruction |
| **Total** | | **25/40** | **Acceptable** |

## Anti-Patterns Verdict

**PASS.** Not AI-generated. No absolute bans violated: no side-stripe borders, no gradient text, no glassmorphism as default, no hero-metric template, no identical card grids, no modal-as-first-thought. The cyan constraint, compact caps convention, backdrop-centric layout, and embossed edges give it genuine character.

**Deterministic scan**: Unavailable — bundled detector not found in this deployment (`detect.mjs` failed with "bundled detector not found"). Manual review substituted.

## Overall Impression

The DetailsSheet is a confident implementation of a difficult component — a bottom sheet that needs to show rich media data, handle complex async state, and provide clear actions. The atmospheric backdrop + gradient treatment is a standout design decision. But the component has two systemic problems: zero user-facing error handling (a PWA can't afford silent failures on every fetch), and an interaction plateau where 10+ tappable targets compete for attention before any content appears. Fixing those two things would lift this from "solid foundation" to "shippable."

## What's Working

1. **Thorough state coverage.** Every tab has loading skeleton, empty state, and data state. Confirmation modal for destructive actions. Undo toasts with 4s duration. The engineering rigor across all 4 info sections is visible and rare.

2. **Atmospheric execution.** Backdrop-as-decoration with multi-stop gradient, embossed sheet edge, cyan signal language. The "Surveillance Room" north star translates to concrete visual decisions at every level — metadata chips, the compact caps labels, the glow on active tabs. Content (posters, stills, backdrops) provides the color; the UI genuinely recedes.

3. **Compact information density.** The metadata chip row, 4-column tab grid, and 3-column action bar pack substantial information without feeling cramped. The caps-only + `tracking-widest` convention creates the instrument-like precision described in the brand. The `[11px] font-black uppercase tracking-widest` chip pattern is elegant and consistent.

## Priority Issues

### P1: No user-facing error recovery (Heuristics H1, H9)
Lines 98, 185, 204, 220: all 4 fetch paths silently catch with `console.error`. A failed TMDB request produces an infinite loading skeleton or silently absent data with no explanation. DESIGN.md explicitly requires "error (red-tinted banner or sheet)" for every async state. No retry mechanism exists.

### P1: Green Watched state breaks the single-voice cyan rule (H4)
Lines 688-697: Active Watched uses `emerald-300/40` border, `emerald-500/30` background, `emerald-300` text, and a full green glow. DESIGN.md states: "Cyan is the only interaction color. If it's interactive, it gets cyan or nothing. Green for 'watched' confirmations ... is a semantic exception, not an aesthetic choice." This implementation isn't a semantic micro-indicator — it's a full second accent color with the same chrome weight as cyan. Either use cyan for both Watched and Watchlist (distinguish with icon only), or reduce green to a restrained indicator (a small dot or checkmark) rather than full parity.

### P2: Interaction plateau — 10 simultaneous options before content (H8)
Lines 368-459 + 678-727: 4 tab buttons + 3 external link buttons + 3 action buttons = 10 interaction targets in direct visual succession, all rendered before any content loads. The external link row (IMDb, Parents Guide, Common Sense) has the same visual weight as the tabs and bottom actions but serves a secondary purpose most users won't need on every sheet. Move external links into the Overview tab or behind a "More" overflow.

### P2: No sheet-specific keyboard shortcuts (H7)
FocusTrap handles Tab cycling but adds no sheet-specific accelerators. No W for Watchlist toggle, no E for Watched toggle, no swipe-down to dismiss. For a PWA that runs on desktop browsers, this creates a mouse-only bottleneck for every action.

### P3: Nested embossed edges contradict elevation model
Line 347: sheet has `embossed-edge`. Line 464: content section also has `embossed-edge` + `shadow-2xl shadow-black/35`. The design system says embossed panels are for "sheets, modals, any raised surface" — having two nested embossed surfaces creates a Russian-doll elevation effect. Replace inner embossed edge with a simpler section treatment (just blueprint border).

## Persona Red Flags

### Sam (Accessibility-Dependent User)
- No `role="tab"` / `aria-selected` / `aria-controls` on the 4 info section buttons — screen reader sees unlabeled toggle buttons, not a tab pattern
- Tab buttons and cast cards have hover states but no `focus-visible:` rings beyond the default `ring-2`
- `text-brand-silver/70` on episode dates and descriptions (lines 543, 548) likely fails WCAG AA 4.5:1
- Silent API failures — screen reader hears nothing when skeletons fail to resolve

### Alex (Impatient Power User)
- Cannot toggle watchlist/watched or close sheet with keyboard. Must click every time.
- Action → close loop takes ~500ms (pulse 200ms + close delay 180ms + slide 120ms). Modal path adds more.
- No batch operations. Alex must repeat: tap item → wait for sheet → tap action → wait for toast → dismiss → repeat.
- Confirmation modal on remove adds extra friction for intentional power user. No "Don't ask again."

### Casey (Distracted Mobile User)
- Tab buttons use 9px text on mobile (line 415). External link buttons use `min-h-10` = 40px on mobile — below 44x44pt HIG target.
- No drag-to-dismiss gesture. Casey using phone one-handed must tap the close button in the bottom bar.
- `getImageUrl(backdropPath, 'original')` loads full-resolution TMDB image on every sheet open — heavy on slow connections.

## Minor Observations

1. Close animation fires at 180ms (line 273) but pulse animation is 200ms (line 686-687). Sheet begins closing before pulse finishes — animation is cut short.
2. Line 362: `via-45%` gradient creates a short transparency window. Starting at `via-60%` would give more visual presence to the backdrop behind the title.
3. When `imdbUrl` is null (lines 441-450), disabled placeholders for IMDb/Parents Guide sit above active Common Sense link — asymmetric visual weight draws attention to dead elements.
4. Line 502: `join(' · ')` with 8+ streaming providers could overflow. No truncation.
5. Loading skeletons use generic `bg-white/10` — no brand-consistent shimmer or cyan hint.
