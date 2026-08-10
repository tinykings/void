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
  JSON.stringify(left) === JSON.stringify(right);

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
    const locationChanged = before?.list !== after?.list;
    const itemChanged = !sameItem(before?.item, after?.item);

    if (locationChanged || itemChanged) {
      if (after) remoteItems.set(key, after);
      else remoteItems.delete(key);
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

  return { version: 3, watchlist, watched, favorites, playedEpisodes };
};
