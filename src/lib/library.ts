import type { Media } from './types';
import { getMediaKey } from './media';

export type LibraryLists = Pick<{ watchlist: Media[]; watched: Media[] }, 'watchlist' | 'watched'>;

export const toggleWatchlistInLibrary = (
  watchlist: Media[],
  watched: Media[],
  media: Media,
  addedAt = new Date().toISOString(),
): LibraryLists => {
  const mediaKey = getMediaKey(media);
  const inWatchlist = watchlist.some((item) => getMediaKey(item) === mediaKey);
  const watchedItem = watched.find((item) => getMediaKey(item) === mediaKey);

  if (inWatchlist) {
    return {
      watchlist: watchlist.filter((item) => getMediaKey(item) !== mediaKey),
      watched,
    };
  }

  return {
    watchlist: [...watchlist, {
      ...media,
      ...(watchedItem?.isFavorite !== undefined ? { isFavorite: watchedItem.isFavorite } : {}),
      ...(media.media_type === 'game' && watchedItem ? { isPurchased: true } : {}),
      date_added: addedAt,
    }],
    watched: watched.filter((item) => getMediaKey(item) !== mediaKey),
  };
};

export const toggleWatchedInLibrary = (
  watchlist: Media[],
  watched: Media[],
  media: Media,
  rating?: number,
  addedAt = new Date().toISOString(),
  checkedAt = Date.now(),
): LibraryLists => {
  const mediaKey = getMediaKey(media);
  const inWatched = watched.some((item) => getMediaKey(item) === mediaKey);
  const watchlistItem = watchlist.find((item) => getMediaKey(item) === mediaKey);

  if (inWatched && rating === undefined) {
    return {
      watchlist,
      watched: watched.filter((item) => getMediaKey(item) !== mediaKey),
    };
  }

  if (inWatched) {
    let updated = false;
    return {
      watchlist: watchlist.filter((item) => getMediaKey(item) !== mediaKey),
      watched: watched.flatMap((item) => {
        if (getMediaKey(item) !== mediaKey) return [item];
        if (updated) return [];
        updated = true;
        return [{ ...item, rating }];
      }),
    };
  }

  return {
    watchlist: watchlist.filter((item) => getMediaKey(item) !== mediaKey),
    watched: [...watched, {
      ...media,
      ...(watchlistItem?.isFavorite !== undefined ? { isFavorite: watchlistItem.isFavorite } : {}),
      ...(rating === undefined ? {} : { rating }),
      date_added: addedAt,
      lastChecked: checkedAt,
    }],
  };
};

export const togglePurchasedInLibrary = (
  watchlist: Media[],
  watched: Media[],
  media: Media,
): LibraryLists => {
  if (media.media_type !== 'game') return { watchlist, watched };

  const mediaKey = getMediaKey(media);
  const watchlistItem = watchlist.find((item) => getMediaKey(item) === mediaKey);
  if (!watchlistItem) return { watchlist, watched };

  return {
    watchlist: watchlist.map((item) => getMediaKey(item) === mediaKey
      ? { ...item, isPurchased: !item.isPurchased }
      : item),
    watched,
  };
};

export const toggleFavoriteInLibrary = (
  watchlist: Media[],
  watched: Media[],
  media: Media,
): LibraryLists => {
  const mediaKey = getMediaKey(media);
  const watchedItem = watched.find((item) => getMediaKey(item) === mediaKey);

  if (watchedItem) {
    return {
      watchlist,
      watched: watched.map((item) => getMediaKey(item) === mediaKey
        ? { ...item, isFavorite: !item.isFavorite }
        : item),
    };
  }

  const watchlistItem = watchlist.find((item) => getMediaKey(item) === mediaKey);
  if (!watchlistItem?.isFavorite) return { watchlist, watched };

  return {
    watchlist: watchlist.map((item) => getMediaKey(item) === mediaKey
      ? { ...item, isFavorite: false }
      : item),
    watched,
  };
};

export const isDateInLocalDayWindow = (dateValue: string, now: Date, windowDays: number) => {
  const parts = dateValue.split('-');
  if (parts.length !== 3) return false;

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;

  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year
    || candidate.getMonth() !== month - 1
    || candidate.getDate() !== day
  ) return false;

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + windowDays);
  end.setHours(23, 59, 59, 999);

  return candidate.getTime() >= start.getTime() && candidate.getTime() <= end.getTime();
};
