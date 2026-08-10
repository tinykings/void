import type { GamePrice, Media } from './types';

export type GameDeal = {
  media: Media;
  price: GamePrice;
};

const getTitle = (media: Media) => media.title || media.name || 'Unknown title';

export const sortGameDeals = (deals: GameDeal[]) => [...deals].sort((a, b) => {
  const aPrice = Number(a.price.lowestCurrent?.amount);
  const bPrice = Number(b.price.lowestCurrent?.amount);
  return aPrice - bPrice || getTitle(a.media).localeCompare(getTitle(b.media));
});
