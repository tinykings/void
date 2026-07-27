import assert from 'node:assert/strict';
import test from 'node:test';
import { groupStreamProviderResults, type StreamProviderResult, type StreamableMedia } from './streamProviders';
import type { WatchProvider } from './types';

const media = (id: number, title: string): StreamableMedia => ({
  id,
  title,
  poster_path: null,
  backdrop_path: null,
  overview: '',
  vote_average: 0,
  popularity: 0,
  media_type: 'movie',
});
const provider = (provider_id: number, provider_name: string): WatchProvider => ({
  provider_id,
  provider_name,
  logo_path: '',
});

test('groupStreamProviderResults groups providers and sorts by coverage then name', () => {
  const alpha = provider(1, 'Alpha');
  const beta = provider(2, 'Beta');
  const results: StreamProviderResult[] = [
    { item: media(1, 'Zulu'), providers: [alpha, beta], contentRating: 'PG', failed: false },
    { item: media(2, 'Alpha title'), providers: [beta], contentRating: null, failed: false },
  ];

  const groups = groupStreamProviderResults(results);

  assert.deepEqual(groups.map((group) => group.provider.provider_name), ['Beta', 'Alpha']);
  assert.deepEqual(groups[0].items.map((item) => item.media.title), ['Alpha title', 'Zulu']);
});
