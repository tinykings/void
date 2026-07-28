import type { GamePrice, Media } from './types';

export const getSteamAppId = (media: Pick<Media, 'id' | 'source' | 'steam_app_id' | 'source_url'> | null | undefined) => {
  if (media?.steam_app_id && Number.isSafeInteger(media.steam_app_id) && media.steam_app_id > 0) {
    return media.steam_app_id;
  }
  // Legacy Steam records use Steam App ID as their primary media ID.
  if (media?.source === 'steam' && Number.isSafeInteger(media.id) && media.id > 0) {
    return media.id;
  }
  if (!media?.source_url) return undefined;

  try {
    const url = new URL(media.source_url);
    if (url.hostname !== 'store.steampowered.com' && url.hostname !== 'www.store.steampowered.com') return undefined;
    const id = Number(url.pathname.match(/^\/app\/(\d+)(?:\/|$)/)?.[1]);
    return Number.isSafeInteger(id) && id > 0 ? id : undefined;
  } catch {
    return undefined;
  }
};

export const formatGamePrice = (price: Pick<GamePrice, 'currency' | 'lowestCurrent'>) => {
  if (!price.lowestCurrent) return '';
  const amount = Number(price.lowestCurrent.amount);
  if (!Number.isFinite(amount)) return '';

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: price.currency,
    }).format(amount);
  } catch {
    return `${price.lowestCurrent.amount} ${price.currency}`;
  }
};
