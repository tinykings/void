import type { Media, WatchProvider } from './types';

export type StreamableMedia = Media & { media_type: 'movie' | 'tv' };
export type StreamProviderItem = {
  media: Media;
  contentRating: string | null;
};
export type StreamProviderGroup = {
  provider: WatchProvider;
  items: StreamProviderItem[];
};
export type StreamProviderResult = {
  item: StreamableMedia;
  providers: WatchProvider[];
  contentRating: string | null;
  failed: boolean;
};

const getMediaTitle = (media: Media) => media.title || media.name || 'Unknown title';

export const groupStreamProviderResults = (results: StreamProviderResult[]): StreamProviderGroup[] => {
  const groupsByProvider = new Map<number, StreamProviderGroup>();

  results.forEach(({ item, providers, contentRating }) => {
    providers.forEach((provider) => {
      const streamItem = { media: item, contentRating };
      const existing = groupsByProvider.get(provider.provider_id);
      if (existing) {
        existing.items.push(streamItem);
      } else {
        groupsByProvider.set(provider.provider_id, { provider, items: [streamItem] });
      }
    });
  });

  return Array.from(groupsByProvider.values())
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => getMediaTitle(a.media).localeCompare(getMediaTitle(b.media))),
    }))
    .sort((a, b) => b.items.length - a.items.length || a.provider.provider_name.localeCompare(b.provider.provider_name));
};
