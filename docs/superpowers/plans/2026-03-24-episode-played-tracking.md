# Episode Played Tracking Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track which TV episodes have been played by the user, showing a checkbox indicator after selecting a stream source.

**Architecture:** Add played episodes state to Zustand store (persisted to IndexedDB), pass callback from DetailsView to StreamPickerModal to mark episode as played when stream is selected.

**Tech Stack:** TypeScript, Zustand, React

---

## File Structure

- **Modify:** `src/store/useStore.ts` - Add playedEpisodes state and actions
- **Modify:** `src/components/PlayTargetModal.tsx` - Add onSelect callback prop
- **Modify:** `src/components/DetailsView.tsx` - Show checkbox, pass callback

---

## Task 1: Add playedEpisodes to Store

**Files:**
- Modify: `src/store/useStore.ts:24-58` (interface), `src/store/useStore.ts:211-227` (initial state), add actions

- [ ] **Step 1: Add playedEpisodes to UserState type in types.ts**

```typescript
// In src/lib/types.ts, add to UserState interface:
playedEpisodes: Record<string, boolean>;
```

- [ ] **Step 2: Add playedEpisodes to StoreState interface and initial state**

In `src/store/useStore.ts`:

1. Add to interface (around line 24):
```typescript
playedEpisodes: Record<string, boolean>;
markEpisodePlayed: (tmdbId: number, seasonNum: number, episodeNum: number) => void;
unmarkEpisodePlayed: (tmdbId: number, seasonNum: number, episodeNum: number) => void;
```

2. Add initial state (around line 226):
```typescript
playedEpisodes: {},
```

3. Add actions (in the return block, around line 277 after `updateMediaMetadata`):
```typescript
markEpisodePlayed: (tmdbId, seasonNum, episodeNum) => set((state) => ({
  playedEpisodes: { ...state.playedEpisodes, [`${tmdbId}-${seasonNum}-${episodeNum}`]: true }
})),

unmarkEpisodePlayed: (tmdbId, seasonNum, episodeNum) => set((state) => {
  const key = `${tmdbId}-${seasonNum}-${episodeNum}`;
  const { [key]: _, ...rest } = state.playedEpisodes;
  return { playedEpisodes: rest };
}),
```

---

## Task 2: Update StreamPickerModal with onSelect callback

**Files:**
- Modify: `src/components/PlayTargetModal.tsx:1-20` (props), `src/components/PlayTargetModal.tsx:100-115` (handleSelect)

- [ ] **Step 1: Add onSelect prop to StreamPickerModal**

In `src/components/PlayTargetModal.tsx`:

1. Add to interface (around line 14):
```typescript
onSelect?: () => void;
```

2. Add to props destructuring (around line 25):
```typescript
onSelect,
```

3. Update handleSelect to call onSelect (around line 109, inside the onClick):
```typescript
onClick={() => {
  handleSelect(buildPlayerUrl(player, mediaType, mediaId, seasonNum, episodeNum));
  onSelect?.();
}}
```

---

## Task 3: Update DetailsView to show checkbox and pass callback

**Files:**
- Modify: `src/components/DetailsView.tsx:21-30` (context), `src/components/DetailsView.tsx:52` (streamPicker state), `src/components/DetailsView.tsx:424-435` (episode row), `src/components/DetailsView.tsx:528-542` (modal props)

- [ ] **Step 1: Add playedEpisodes to context destructuring**

In `src/components/DetailsView.tsx`, add to the useAppContext destructuring (around line 21-30):
```typescript
playedEpisodes,
markEpisodePlayed,
```

- [ ] **Step 2: Add handler for episode selection**

After the `handleWatchedToggle` function (around line 199), add:
```typescript
const handleEpisodeSelect = () => {
  if (streamPicker.seasonNum !== undefined && streamPicker.episodeNum !== undefined) {
    markEpisodePlayed(media.id, streamPicker.seasonNum, streamPicker.episodeNum);
  }
};
```

- [ ] **Step 3: Pass onSelect to StreamPickerModal**

In `src/components/DetailsView.tsx`, add `onSelect={handleEpisodeSelect}` to the StreamPickerModal props (around line 528-542):
```typescript
<StreamPickerModal
  isOpen={streamPicker.open}
  onClose={() => setStreamPicker({ open: false })}
  title={...}
  mediaType={media.media_type}
  mediaId={media.id}
  seasonNum={streamPicker.seasonNum}
  episodeNum={streamPicker.episodeNum}
  vidAngelSlug={streamPicker.seasonNum === undefined ? vidAngelSlug : null}
  externalPlayerEnabled={externalPlayerEnabled}
  onSelect={handleEpisodeSelect}
/>
```

- [ ] **Step 4: Add checkbox to episode row**

In the episode list mapping (around line 412-448), modify the episode row to show checkbox:

Around line 433-436, modify:
```tsx
<div className="absolute bottom-1 right-1 bg-brand-bg/80 text-white text-[8px] sm:text-[10px] font-bold px-1 rounded pointer-events-none blueprint-border">
  S{ep.season_number} E{ep.episode_number}
</div>
```

To:
```tsx
<div className="absolute bottom-1 left-1 right-1 flex items-center justify-between pointer-events-none">
  {playedEpisodes[`${media.id}-${ep.season_number}-${ep.episode_number}`] && (
    <span className="text-brand-cyan text-[8px] sm:text-[10px] font-bold">✓</span>
  )}
  <span className="bg-brand-bg/80 text-white text-[8px] sm:text-[10px] font-bold px-1 rounded blueprint-border ml-auto">
    S{ep.season_number} E{ep.episode_number}
  </span>
</div>
```

---

## Verification

- [ ] Run `npm run lint` to check for errors
- [ ] Verify the app builds with `npm run build`
- [ ] Test manually: go to a TV show details page, click play on an episode, select a stream, verify checkbox appears next to the episode
