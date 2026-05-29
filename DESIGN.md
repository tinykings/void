---
name: Void
description: A movie and TV show tracker
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
    letterSpacing: "normal"
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
    fontFamily: "Inter, Arial, Helvetica, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "0.18em"
    textTransform: "uppercase"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  pill: "28px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "#22D3EE"
    textColor: "#0F1115"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    fontWeight: 900
    textTransform: "uppercase"
    letterSpacing: "0.1em"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.brand-silver}"
    rounded: "{rounded.sm}"
    padding: "8px"
  input:
    backgroundColor: "{colors.brand-bg}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "12px"
    borderColor: "{colors.blueprint-border}"
  card:
    backgroundColor: "{colors.brand-bg}"
    rounded: "{rounded.md}"
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
**The Single Voice Rule.** Cyan is the only interaction color. Green for "watched" confirmations and red for "remove" danger are semantic exceptions, not aesthetic choices. If it's interactive, it gets cyan or nothing.

**The Blueprint Edge Rule.** Every surface boundary is `1px solid rgba(255,255,255,0.1)`. Not 2px, not colored. A thicker border is a mistake; a colored side-stripe is forbidden.

## 3. Typography

**Display Font:** Inter (system sans-serif fallback: Arial, Helvetica)
**Body Font:** Inter (same stack)

**Character:** Inter at small sizes with high weight contrast. The system is almost entirely set in regular (500), semibold (600), or black (900). No intermediate weights. The jump from metadata silver (500) to title white (900) creates the hierarchy — no size tricks needed.

### Hierarchy
- **Display** (Black 900, `clamp(1.5rem, 4vw, 1.875rem)`, 1.1): Main sheet titles. Only the media title gets this scale. Uppercase italic variant for section headers like "Settings" and "Stream."
- **Headline** (Semibold 600, `1.125rem`, 1.3): Sheet section headers ("Overview," "Cast"), settings group titles. Rare.
- **Body** (Medium 500, `0.875rem`, 1.5): Overview text, descriptions, sync status. Max line length 65ch inside sheet content.
- **Label Caps** (Black 900, `0.6875rem`, 1.2, `0.18em` tracking, uppercase): Filters, tabs, badges, metadata chips, button labels. The workhorse of the UI. Compact density is the point: labels this small and this bold read as confident, not small.
- **Micro Label** (Black 900, `0.625rem`, 1.2, `0.2em` tracking, uppercase): Content rating badges, release count tags, smallest chrome.

### Named Rules
**The Caps-Only UI Rule.** All navigation, filter, badge, and button text is uppercase with wide tracking. The only lowercase text in the interface is content — titles, descriptions, metadata values. This draws a hard line between the frame (UI) and the picture (content).

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
- **Shape:** Gently rounded corners (12px rounded-xl) for primary and sheet actions. Fully rounded (28px pill or 9999px full) for icon-only and bottom-bar buttons.
- **Primary CTA** (e.g., "Save," "Sync"): Solid cyan fill (`#22D3EE`), dark text (`#0F1115`), black 900 weight, uppercase, wide tracking. Hover brightens; active scales down slightly (`scale(95%)`).
- **Ghost / Icon** (e.g., filter buttons, close buttons): Transparent, silver text at rest. On hover, cyan/10 background tint with cyan text. No border unless it's a grouped control.
- **Action in Sheets** ("Watched," "Watchlist"): Bordered with background tint. Active state gets a stronger tint, cyan glow, and slight lift (`translateY(-0.5px)`).
- **Pulse on Confirm:** Action buttons in the details sheet animate a scale pulse on press (1 → 1.06 → 0.98 → 1, 200ms ease-out).

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
- **Container:** Full-width, `max-w-4xl`, `86vh` height, `rounded-t-3xl` (24px) top corners. Embossed edge border treatment. Background is `brand-bg/95` — almost opaque, letting only a whisper of content through.
- **Animation:** Slide up from `y: 100%` to `y: 0` over 120ms, ease-out. Overlay fades in over the same duration.
- **Drag Handle:** A cyan-bordered bar at the bottom of every sheet. Tapping closes the sheet.

### Navigation (Bottom Bar)
- **Style:** Fixed bottom, pill-shaped (28px radius), glass background (`bg-brand-bg/70 backdrop-blur-xl`), blueprint border. Deepest shadow in the system.
- **Layout:** Three zones: filter/menu (left), Library/Watchlist toggle (center), search (right).
- **Toggle:** A two-segment control with an animated cyan pill indicator (`300ms ease-out`). The pill slides between Library and Watchlist positions. Active segment gets cyan text; inactive gets silver.
- **Context badge:** Floating status pill above the bar showing the current view ("Watchlist · All," "Library · Movies").

### Chips / Badges
- **Style:** `rounded-full` with `bg-white/10` background, 10px black 900 uppercase label, wide tracking. Used for content ratings, media type labels (movie/TV), year, vote average.
- **Release Badge:** Same shape but darker (`bg-brand-bg/90 backdrop-blur-md`) with cyan text, blueprint border. Appears on cards when a release is upcoming.

### Modals (Confirmation)
- **Style:** Glass-effect surface (`rounded-3xl`, `bg-brand-bg/60`, `backdrop-filter: blur(20px)`, blueprint border), centered. Scale-up entrance animation (0.9 → 1, 20px upward slide).
- **Icon container:** 64px square, `rounded-2xl`, blueprint border. Cyan tint for info actions, red tint for destructive.
- **Actions:** Full-width primary button + ghost cancel link below.

## 6. Do's and Don'ts

### Do:
- **Do** use cyan as the single interaction color. If it's tappable and active, it gets cyan.
- **Do** use the Caps-Only UI convention for all navigation, labels, and buttons. Lowercase is reserved for content.
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
