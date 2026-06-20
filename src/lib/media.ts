import { Media, MediaSource } from './types';

export const getMediaSource = (media: Pick<Media, 'media_type' | 'source'>): MediaSource => {
  if (media.source) return media.source;
  return media.media_type === 'game' ? 'rawg' : 'tmdb';
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
