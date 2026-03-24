# Episode Played Tracking - Design

## Overview
Track which TV show episodes have been played by the user. When a user selects a stream source for an episode, mark that episode as played with a checkbox indicator.

## Data Model

### Store State Addition
```typescript
playedEpisodes: Record<string, boolean>
```
- Key format: `${tmdbId}-${seasonNum}-${episodeNum}`
- Stored in IndexedDB via existing zustand persist middleware

## Store Actions

### markEpisodePlayed
```typescript
markEpisodePlayed: (tmdbId: number, seasonNum: number, episodeNum: number) => void
```
- Adds entry to `playedEpisodes` with key `${tmdbId}-${seasonNum}-${episodeNum}`

### unmarkEpisodePlayed
```typescript
unmarkEpisodePlayed: (tmdbId: number, seasonNum: number, episodeNum: number) => void
```
- Removes entry from `playedEpisodes`

### isEpisodePlayed (selector/helper)
```typescript
isEpisodePlayed: (tmdbId: number, seasonNum: number, episodeNum: number) => boolean
```
- Returns whether an episode has been played

## UI Changes

### StreamPickerModal
- Add optional `onSelect` callback prop
- Fire `onSelect()` when user selects a stream source (in addition to opening URL)
- Signature: `onSelect?: () => void`

### DetailsView
- Import `isEpisodePlayed` helper from store
- Pass `onSelect` to `StreamPickerModal`
- In episode list, display checkbox (✓) next to played episodes
- Checkbox positioned to the left of "S{season} E{episode}" label

## Persistence
- All played episode data persisted to IndexedDB via existing zustand storage
- Survives browser refresh and session navigation
