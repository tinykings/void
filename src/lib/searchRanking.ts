import type { Media } from './types';

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const getSearchRank = (media: Media, query: string, index: number) => {
  const title = normalizeSearchText(media.title || media.name || '');
  const search = normalizeSearchText(query);
  const popularity = media.popularity || media.vote_count || 0;

  if (!title || !search) return 10_000 + index;
  if (title === search) return 0 - popularity / 1_000_000;
  if (title.startsWith(search)) return 100 + title.length - search.length - popularity / 1_000_000;
  if (title.includes(search)) return 300 + title.indexOf(search) + title.length / 100 - popularity / 1_000_000;

  const searchWords = search.split(' ').filter(Boolean);
  const titleWords = title.split(' ').filter(Boolean);
  const matchingWords = searchWords.filter((word) => titleWords.some((titleWord) => titleWord.startsWith(word))).length;

  if (matchingWords > 0) {
    return 600 + (searchWords.length - matchingWords) * 50 + title.length / 100 - popularity / 1_000_000;
  }

  return 1_000 + index - popularity / 1_000_000;
};

export const rankSearchResults = (results: Media[], query: string) =>
  results
    .map((media, index) => ({ media, rank: getSearchRank(media, query, index), index }))
    .sort((a, b) => a.rank - b.rank || b.media.popularity - a.media.popularity || a.index - b.index)
    .map((item) => item.media);
