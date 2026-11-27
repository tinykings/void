import { CastMember, Media, MediaSource } from './types';

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

/** Try the normal artwork first, then a different TMDB CDN size if an image fails. */
export const getPosterCandidates = (
  posterPath: string | null, backdropPath: string | null,
  buildTmdbUrl: (path: string, size: 'w342' | 'w185') => string,
) => {
  const paths = [posterPath, backdropPath];
  const candidates = [
    ...paths.map((path) => getImageSrc(path, (value) => buildTmdbUrl(value, 'w342'))),
    ...paths.filter((path): path is string => !!path && /^\/(?!\/)/.test(path))
      .map((path) => buildTmdbUrl(path, 'w185')),
  ];
  return [...new Set(candidates.filter(Boolean))];
};

export const getMediaTitle = (media: Pick<Media, 'title' | 'name'>) => media.title || media.name || 'Unknown title';

export const getPersonHref = (person: Pick<CastMember, 'id' | 'name'>) => {
  const params = new URLSearchParams({ id: String(person.id), name: person.name });
  return `/person?${params.toString()}`;
};

export const getDetailsHref = (media: Pick<Media, 'id' | 'media_type' | 'source' | 'title' | 'name'>) => {
  const params = new URLSearchParams({
    id: String(media.id),
    type: media.media_type,
    source: getMediaSource(media),
    title: getMediaTitle(media),
  });

  return `/details?${params.toString()}`;
};
