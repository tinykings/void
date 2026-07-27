---
name: Void
description: A movie, show, and game tracker
colors:
  brand-bg: "#0F1115"
  surface-raised: "#1A1D23"
  foreground: "#F8FAFC"
  brand-cyan: "#22D3EE"
  brand-silver: "#94A3B8"
  blueprint-border: "rgba(255,255,255,0.1)"
  overlay: "rgba(0,0,0,0.7)"
  surface-highlight: "rgba(255,255,255,0.03)"
typography:
  display:
    fontFamily: "Inter, Arial, Helvetica, sans-serif"
    fontSize: "clamp(1.5rem, 4vw, 1.875rem)"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, Arial, Helvetica, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter, Arial, Helvetica, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.12em"
    textTransform: "uppercase"
  readout:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.035em"
rounded:
  control: "8px"
  content: "12px"
  sheet: "24px 24px 0 0"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "#22D3EE"
    textColor: "#0F1115"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    fontWeight: 700
    textTransform: "none"
    letterSpacing: "0"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.brand-silver}"
    rounded: "{rounded.control}"
    padding: "8px"
  input:
    backgroundColor: "{colors.brand-bg}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "12px"
    borderColor: "{colors.blueprint-border}"
  card:
    backgroundColor: "{colors.brand-bg}"
    rounded: "{rounded.content}"
    borderColor: "{colors.blueprint-border}"
---

# Design System: Void

## 1. Overview

**Creative North Star: "The Surveillance Room"**

This is not a cozy streaming service. Void is a dim, instrument-like interface — a wall of monitors in a dark room, each screen displaying signal data. The cyan glow has purpose: it marks what's active, what's playing, what's coming next. Everything else recedes into darkness.

The content — movie posters, show stills, backdrop images — provides the color. The interface is the frame, not the picture. Chrome is thin: 1px blueprint borders, translucent glass surfaces, compact uppercase labels. No decorative gradients, no hero metrics, no social feed chrome.

**Key Characteristics:**
- Dark ground as material, not theme. The void is the starting point, not a mode.
- Cyan as the single voice for interaction — active, selected, available.
- Glass surfaces float above the void. Depth through translucency, not shadows.
- Every uppercase label earns its weight. Nothing is 12px bold by accident.
- Content (posters, backdrops, stills) is the only color source outside the cyan signal.

## 2. Colors

One accent, one neutral, one ground. The palette is deliberately narrow: cyan says "interactive," silver says "information," the void is silence.

### Primary
- **Cyan Signal** (`#22D3EE` / `oklch(75% 0.155 215)`): The single interaction color. Active filters, selected tabs, primary CTAs, glow states. Used on ≤15% of any screen — its rarity is the signal.

### Neutral
- **Void Ground** (`#0F1115` / `oklch(14.5% 0.004 260)`): The base surface. Never pure black. Slightly cool, slightly blue.
- **Surface Raised** (`#1A1D23` / `oklch(18% 0.005 260)`): Secondary surface for hovering states, section headers, and panels that need subtle distinction from the void ground without breaking the dark hierarchy.
- **Foreground** (`#F8FAFC` / `oklch(96.5% 0.003 255)`): Primary text. Near-white with a cool cast.
- **Silver Information** (`#94A3B8` / `oklch(67% 0.03 255)`): Secondary text, metadata, muted labels. The default state for inactive controls.
- **Blueprint Border** (`rgba(255,255,255,0.1)`): All structural edges. 1px, never thicker. Defines surfaces without calling attention to itself.
- **Overlay** (`rgba(0,0,0,0.7)` / `rgba(0,0,0,0.8)`): Sheet backdrops. Heavy blur is paired with this to create depth.

### Named Rules
**The Single Voice Rule.** Cyan is the only interaction color. Green for history confirmations and red for "remove" danger are semantic exceptions, not aesthetic choices. If it's interactive, it gets cyan or nothing.

**The Blueprint Edge Rule.** Every resting surface boundary is `1px solid rgba(255,255,255,0.1)`. Not 2px, not colored. Interaction colors may appear on focus, hover, selection, and semantic error states. A colored side-stripe is forbidden.

**The Three-Radius Rule.** Controls use 8px, content cards use 12px, and sheet top corners use 24px. Pills are reserved for statuses and segmented controls. No intermediate corner role exists.

## 3. Typography

**Display and body font:** Inter (system sans-serif fallback: Arial, Helvetica)
**Utility font:** IBM Plex Mono (monospace fallback)

**Character:** Inter keeps titles, actions, and reading text direct and neutral. IBM Plex Mono gives compact operational data the voice of equipment labels and monitor readouts. Contrast comes from role, not arbitrary size and tracking changes.

### Hierarchy
- **Display / `.type-display`** (Inter Black 900, `clamp(1.5rem, 4vw, 1.875rem)`, 1.1): Media and primary view titles. Sentence case; content names are never forced uppercase.
- **Title / `.type-title`** (Inter Semibold 600, `1.125rem`, 1.3): Sheet headers and settings group titles.
- **Body / `.type-body`** (Inter Medium 500, `0.875rem`, 1.5): Overview text, descriptions, sync status. Max line length 65ch inside sheet content.
- **Action / `.type-action`** (Inter Bold 700, `0.875rem`, 1.2): Buttons and navigation actions. Sentence case with normal tracking.
- **Filter / `.type-filter`** (IBM Plex Mono Semibold 600, `0.875rem`, 1.2): Filter choices. Sentence case with compact tracking.
- **Utility Label / `.type-label`** (IBM Plex Mono Bold 700, `0.6875rem`, 1.2, `0.12em` tracking): Short labels such as “Born,” “Known for,” and provider sections. Uppercase.
- **Micro Label / `.type-micro`** (IBM Plex Mono Bold 700, `0.625rem`, 1.2, `0.14em` tracking): Content ratings, release badges, and smallest chrome. Uppercase.
- **Readout / `.type-readout`** (IBM Plex Mono Semibold 600, `0.75rem`, 1.25): Counts, ratings, dates, source lines, timestamps, and status values. Uses tabular numerals and preserves value casing.

### Named Rules
**The Instrument Readout Rule.** Monospace identifies operational data, not every control. Use it for labels and values a user scans rather than reads. Uppercase is reserved for short utility labels and micro badges. Actions and explanatory copy remain sentence case in Inter.

## 4. Elevation

The system uses layered glass, not drop shadows. Surfaces are defined by their edge (1px blueprint border) and their translucency (`backdrop-blur-xl` on `rgba(15,17,21, X)` backgrounds). Deeper layers are more opaque; the topmost layer (the sheet) is the most solid at 95% opacity.

Sheets overlay the void with `embossed-edge` border treatment: an inner highlight `(inset 0 1px 0 rgba(255,255,255,0.08))` paired with an ambient shadow `(0 4px 12px rgba(0,0,0,0.25))` to suggest a raised glass panel. The overlay behind a sheet is `rgba(0,0,0,0.7)` with `backdrop-blur-sm` — just enough to dissolve the content below without making the sheet feel isolated.

### Shadow Vocabulary
- **Embossed Panel** (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 3px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.25)`): Sheets, modals, any raised surface.
- **Cyan Active Glow** (`box-shadow: 0 0 15px rgba(34,211,238,0.1)` to `0 0 22px rgba(34,211,238,0.16)`): Active filter tabs, selected chips, focused inputs. The glow is always tied to the cyan signal color.
- **Bottom Bar Float** (`box-shadow: 0 0 35px rgba(0,0,0,0.35)`): The fixed bottom navigation bar. Deepest shadow in the system.

### Named Rules
**The Glass-Not-Shadow Rule.** Surfaces are layered by opacity, not stacked by shadow. Drop shadows only appear for embossed panels and active-state glow. Resting cards have no shadow — their blueprint border is sufficient definition.

## 5. Components

### Buttons
- **Shape:** Controls and sheet actions use 8px corners. Fully rounded pills are reserved for statuses and segmented controls. Every touch target is at least 44px on each interactive axis.
- **Primary CTA** (e.g., "Save," "Sync"): Solid cyan fill (`#22D3EE`), dark text (`#0F1115`), Inter bold 700 in sentence case. Hover brightens; active scales down slightly (`scale(95%)`).
- **Ghost / Icon** (e.g., filter buttons, close buttons): Transparent, silver text at rest. On hover, cyan/10 background tint with cyan text. No border unless it's a grouped control.
- **Action in Sheets** ("History," "Playlist"): Bordered with background tint. Active state gets a stronger tint, cyan glow, and slight lift (`translateY(-0.5px)`).
- **Pulse on Confirm:** Action buttons in the details sheet animate a scale pulse on press (1 → 1.06 → 0.98 → 1, 200ms ease-out). Framer Motion suppresses transforms when user requests reduced motion.

### Cards (MediaCard)
- **Corner Style:** 12px rounded-xl. No inner padding — the poster fills the entire card.
- **Background:** Void ground (`#0F1115`). No shadow at rest.
- **Border:** Blueprint border (1px `rgba(255,255,255,0.1)`).
- **Interaction:** On parent hover, the poster image scales to 105% over 300ms. No other chrome change — the image IS the card.
- **Skeleton:** Pulse animation (`animate-pulse`) on a `bg-white/10` placeholder at the same 2:3 aspect ratio.

### Inputs / Text Fields
- **Style:** Void ground background, blueprint border, 8px rounded-lg. Text is foreground white; placeholder is silver at 50% opacity.
- **Focus:** `ring-1 ring-brand-cyan` and optional cyan drop glow (`0 0 20px rgba(34,211,238,0.08)`). No border color shift — just the ring.
- **Error / Disabled:** Disabled inputs fade to `opacity-50 cursor-not-allowed`. Error states use red tint with `border-red-400/30` and `bg-red-500/10`.

### Sheets (Bottom Drawer)
- **The signature component of Void.** One sheet at a time, slides up from the bottom.
- **Container:** Every sheet uses shared `sheet-surface`: full-width, `max-width: 72rem`, `height: min(92dvh, 60rem)`, and 24px top corners. Single-purpose sheets with little content may add `sheet-surface-compact` for `height: min(70dvh, 32rem)`. Embossed edge border treatment. Background is `brand-bg/95` — almost opaque, letting only a whisper of content through.
- **Animation:** Slide up from `y: 100%` to `y: 0` over 120ms, ease-out. Overlay fades in over same duration. No child-content reveals or stagger. Global Framer Motion config follows `prefers-reduced-motion`; CSS also suppresses non-Framer animation and smooth scrolling.
- **Drag Handle:** A cyan-bordered bar at bottom of every sheet. Tapping closes sheet. Fixed action floors, scroll clearance, and drag handles include `env(safe-area-inset-bottom)`.

### Navigation (Bottom Bar)
- **Style:** Fixed bottom, pill-shaped (28px radius), glass background (`bg-brand-bg/70 backdrop-blur-xl`), blueprint border. Deepest shadow in the system.
- **Layout:** Three zones: filter/menu (left), History/Playlist toggle (center), search (right).
- **Toggle:** A two-segment control with an animated cyan pill indicator (`300ms ease-out`). The pill slides between History and Playlist positions. Active segment gets cyan text; inactive gets silver.
- **Context badge:** Floating status pill above bar showing current view ("Playlist · All," "History · Movies").
- **Safe area:** Bar bottom padding and bottom-positioned toast offset include `env(safe-area-inset-bottom)` so installed iOS layouts clear home indicator.

### Chips / Badges
- **Style:** `rounded-full` with `bg-white/10` background and the IBM Plex Mono micro-label role. Used for content ratings and short media-type labels; numeric year and vote values use the readout role.
- **Release Badge:** Same shape but darker (`bg-brand-bg/90 backdrop-blur-md`) with cyan text, blueprint border. Appears on cards when a release is upcoming.

### Modals (Confirmation)
- **Style:** Active embossed surface (12px content radius, `bg-brand-bg/95`, blueprint border), centered. Scale-up entrance animation (0.9 → 1, 20px upward slide).
- **Icon container:** 64px square, 12px content radius, blueprint border. Cyan tint for info actions, red tint for destructive.
- **Actions:** Full-width primary button + ghost cancel link below.

## 6. Do's and Don'ts

### Do:
- **Do** use cyan as the single interaction color. If it's tappable and active, it gets cyan.
- **Do** use IBM Plex Mono for compact labels, ratings, dates, counts, sources, timestamps, and status readouts. Keep actions and explanatory copy in sentence case.
- **Do** let poster art and backdrops provide the color. The interface is the frame.
- **Do** use blueprint borders (1px `rgba(255,255,255,0.1)`) for every surface boundary.
- **Do** use glass layering (translucency + backdrop-blur) to create depth. Sheets at 95%, bottom bar at 70%, overlays at 60-80% opacity.
- **Do** use the embossed edge border treatment (inner highlight + ambient shadow) for raised surfaces like sheets and modals.
- **Do** keep card grids compact (gap-2 = 8px). Information density is part of the identity.
- **Do** account for every async state: loading (pulse skeleton), empty (centered message with next-step guidance), error (red-tinted banner or sheet).

### Don't:
- **Don't** use black (`#000`) or white (`#fff`). Tint all neutrals toward the cool-blue brand hue.
- **Don't** use colored side-stripe borders (`border-left: 3px solid cyan` or similar). All borders are full perimeter blueprint borders.
- **Don't** use gradient text (`background-clip: text`). Emphasis comes from weight and size, not gradients.
- **Don't** use glassmorphism as a default. Glass is for sheets and bars, not cards or buttons.
- **Don't** build hero-metric templates (big number, small label, gradient accent). Void doesn't sell anything.
- **Don't** use identical card grids with icon + heading + text. Media cards show poster art; grid items are not marketing tiles.
- **Don't** use bounce or elastic easing. Sheet animations use `easeOut` at 120-200ms; tab pill slides at 300ms `ease-out`.
- **Don't** use modals as the first interaction pattern — exhaust sheet-based progressive disclosure first. (Confirmations are the single valid modal use case.)
- **Don't** over-design empty states. A centered message and one clear next step is enough.
- **Don't** add layout animations — no opacity transitions on grid items, no staggered card entrances. Framer Motion is for sheets, overlays, and action pulses only.
