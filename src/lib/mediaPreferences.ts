import type { EnabledMediaTypes } from './types';

/** Games remain readable in old libraries, but cannot be enabled in this client. */
export const normalizeMediaPreferences = (saved?: Partial<EnabledMediaTypes> | null): EnabledMediaTypes => {
  const movie = saved?.movie !== false;
  const tv = saved?.tv !== false;
  // A legacy games-only preference must not leave this version with an empty UI.
  return { movie: movie || !tv, tv: tv || !movie, game: false };
};
