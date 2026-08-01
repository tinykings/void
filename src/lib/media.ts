import { Media, MediaSource } from './types';

export const getMediaSource = (media: Pick<Media, 'media_type' | 'source'>): MediaSource => {
  if (media.source) return media.source;
  return media.media_type === 'game' ? 'igdb' : 'tmdb';
};

export const getMediaKey = (media: Pick<Media, 'id' | 'media_type' | 'source'>) => {
  return `${getMediaSource(media)}-${media.media_type}-${media.id}`;
};

export const getImageSrc = (path: string | null, buildTmdbUrl: (path: string) => string) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return buildTmdbUrl(path);
};

export const getMediaTitle = (media: Pick<Media, 'title' | 'name'>) => media.title || media.name || 'Unknown title';

export const getDetailsHref = (media: Pick<Media, 'id' | 'media_type' | 'source' | 'title' | 'name'>) => {
  const params = new URLSearchParams({
    id: String(media.id),
    type: media.media_type,
    source: getMediaSource(media),
    title: getMediaTitle(media),
  });

  return `/details?${params.toString()}`;
};
