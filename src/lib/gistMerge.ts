import type { GistLibraryData, GistLibraryItem } from './gist';

type ListName = 'watchlist' | 'watched';
type LocatedItem = { item: GistLibraryItem; list: ListName };

const itemKey = (item: GistLibraryItem) => {
  const source = item.source || (item.media_type === 'game' ? 'igdb' : 'tmdb');
  return `${source}-${item.media_type}-${item.id}`;
};

const locateItems = (payload: GistLibraryData) => {
  const located = new Map<string, LocatedItem>();
  payload.watchlist.forEach((item) => located.set(itemKey(item), { item, list: 'watchlist' }));
  payload.watched.forEach((item) => located.set(itemKey(item), { item, list: 'watched' }));
  return located;
};

const favoriteKeys = (payload: GistLibraryData) =>
  new Set(payload.favorites.map(itemKey));

const sameItem = (left?: GistLibraryItem, right?: GistLibraryItem) =>
  JSON.stringify(left && { ...left, pinnedAt: undefined, returnedFor: undefined })
    === JSON.stringify(right && { ...right, pinnedAt: undefined, returnedFor: undefined });

/** Applies changes made locally since baseline to newest remote payload. */
export const mergeGistChanges = (
  remote: GistLibraryData,
  baseline: GistLibraryData,
  local: GistLibraryData,
): GistLibraryData => {
  const remoteItems = locateItems(remote);
  const baselineItems = locateItems(baseline);
  const localItems = locateItems(local);
  const baselineFavorites = favoriteKeys(baseline);
  const localFavorites = favoriteKeys(local);
  const mergedFavorites = favoriteKeys(remote);
  const changedKeys = new Set([...baselineItems.keys(), ...localItems.keys()]);

  for (const key of changedKeys) {
    const before = baselineItems.get(key);
    const after = localItems.get(key);
    const remoteBefore = remoteItems.get(key);
    const automaticReturn = before?.list === 'watched' && after?.list === 'watchlist'
      && after.item.returnedFor !== undefined && after.item.returnedFor !== before.item.returnedFor;
    // A queued automatic return must not undo another device's play, move, or removal.
    const staleReturn = automaticReturn && (remoteBefore?.list !== 'watched'
      || (remoteBefore.item.returnedFor !== undefined && remoteBefore.item.returnedFor >= after.item.returnedFor!));
    const locationChanged = before?.list !== after?.list;
    const itemChanged = !sameItem(before?.item, after?.item);

    if ((locationChanged || itemChanged) && !staleReturn) {
      if (after) {
        const item = { ...after.item };
        const pin = locationChanged ? after.item.pinnedAt : remoteItems.get(key)?.item.pinnedAt;
        if (pin) item.pinnedAt = pin;
        else delete item.pinnedAt;
        remoteItems.set(key, { ...after, item });
      } else remoteItems.delete(key);
    }

    // Remember the latest returned episode independently of unrelated metadata/list edits.
    const current = remoteItems.get(key);
    if (current?.item.media_type === 'tv') {
      const dates = [remoteBefore?.item.returnedFor, before?.item.returnedFor,
        staleReturn ? undefined : after?.item.returnedFor].filter((date): date is string => !!date);
      const returnedFor = dates.sort().at(-1);
      if (returnedFor) remoteItems.set(key, { ...current, item: { ...current.item, returnedFor } });
    }

    // Pin changes merge independently of metadata, favorites, and other devices' edits.
    const merged = remoteItems.get(key);
    if (merged && before?.item.pinnedAt !== after?.item.pinnedAt && after) {
      const item = { ...merged.item };
      if (after.item.pinnedAt) item.pinnedAt = after.item.pinnedAt;
      else delete item.pinnedAt;
      remoteItems.set(key, { ...merged, item });
    }

    if (baselineFavorites.has(key) !== localFavorites.has(key)) {
      if (localFavorites.has(key) && after) mergedFavorites.add(key);
      else mergedFavorites.delete(key);
    }
  }

  const playedEpisodes = { ...(remote.playedEpisodes ?? {}) };
  const baselineEpisodes = baseline.playedEpisodes ?? {};
  const localEpisodes = local.playedEpisodes ?? {};
  const episodeKeys = new Set([...Object.keys(baselineEpisodes), ...Object.keys(localEpisodes)]);
  for (const key of episodeKeys) {
    if (baselineEpisodes[key] === localEpisodes[key]) continue;
    if (localEpisodes[key]) playedEpisodes[key] = true;
    else delete playedEpisodes[key];
  }

  const watchlist: GistLibraryItem[] = [];
  const watched: GistLibraryItem[] = [];
  for (const { item, list } of remoteItems.values()) {
    if (list === 'watchlist') watchlist.push(item);
    else watched.push(item);
  }

  const libraryByKey = new Map([...watchlist, ...watched].map((item) => [itemKey(item), item]));
  const favorites = [...mergedFavorites]
    .map((key) => libraryByKey.get(key))
    .filter((item): item is GistLibraryItem => !!item);

  return { version: 6, watchlist, watched, favorites, playedEpisodes };
};
