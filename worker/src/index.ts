type Env = {
  IGDB_CLIENT_ID: string;
  IGDB_CLIENT_SECRET: string;
  ALLOWED_ORIGINS?: string;
};

type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
};

type IgdbImage = {
  image_id?: string;
};

type IgdbNamedItem = {
  name?: string;
};

type IgdbWebsite = {
  url?: string;
};

type IgdbGame = {
  id: number;
  name?: string;
  slug?: string;
  summary?: string;
  first_release_date?: number;
  total_rating?: number;
  total_rating_count?: number;
  cover?: IgdbImage;
  screenshots?: IgdbImage[];
  platforms?: IgdbNamedItem[];
  genres?: IgdbNamedItem[];
  websites?: IgdbWebsite[];
  videos?: { name?: string; video_id?: string }[];
};

type TokenCache = {
  value: string;
  expiresAt: number;
};

const IGDB_BASE_URL = 'https://api.igdb.com/v4';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const SEARCH_CACHE_SECONDS = 60 * 60;
const DETAILS_CACHE_SECONDS = 60 * 60 * 24;

let tokenCache: TokenCache | null = null;

const getAllowedOrigins = (env: Env) => {
  const configured = env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean);
  return configured && configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
};

const getCorsOrigin = (request: Request, env: Env) => {
  const origin = request.headers.get('Origin');
  const allowedOrigins = getAllowedOrigins(env);

  if (allowedOrigins.includes('*')) return '*';
  if (!origin) return '*';
  return allowedOrigins.includes(origin) ? origin : '';
};

const corsHeaders = (request: Request, env: Env) => {
  const origin = getCorsOrigin(request, env);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };

  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
};

const jsonResponse = (request: Request, env: Env, data: unknown, init: ResponseInit = {}) => {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request, env),
      ...init.headers,
    },
  });
};

const errorResponse = (request: Request, env: Env, status: number, error: string) => {
  return jsonResponse(request, env, { error }, { status });
};

const escapeIgdbString = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const imageUrl = (imageId: string | undefined, size: string) => {
  if (!imageId) return null;
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
};

const dateFromUnixSeconds = (value?: number) => {
  if (!value) return undefined;
  return new Date(value * 1000).toISOString().split('T')[0];
};

const normalizeGame = (game: IgdbGame) => {
  const screenshots = (game.screenshots || [])
    .map((image) => imageUrl(image.image_id, 'screenshot_big_2x'))
    .filter((url): url is string => !!url);
  const poster = imageUrl(game.cover?.image_id, 'cover_big_2x') || screenshots[0] || null;
  const slug = game.slug || '';
  const videos = (game.videos || [])
    .filter((video) => video.video_id)
    .map((video) => ({
      id: video.video_id || '',
      key: video.video_id || '',
      name: video.name || 'Trailer',
      site: 'YouTube',
      type: 'Trailer',
      official: true,
      published_at: '',
    }));

  return {
    id: game.id,
    title: game.name || 'Unknown',
    name: game.name || 'Unknown',
    poster_path: poster,
    backdrop_path: screenshots[0] || poster,
    overview: game.summary || '',
    release_date: dateFromUnixSeconds(game.first_release_date),
    vote_average: game.total_rating ? game.total_rating / 10 : 0,
    vote_count: game.total_rating_count || 0,
    popularity: game.total_rating_count || 0,
    media_type: 'game',
    source: 'igdb',
    poster_source: 'igdb',
    platforms: (game.platforms || []).map((platform) => platform.name).filter(Boolean),
    genres: (game.genres || []).map((genre) => genre.name).filter(Boolean),
    website: game.websites?.find((site) => site.url)?.url || null,
    screenshots,
    videos,
    source_url: slug ? `https://www.igdb.com/games/${slug}` : undefined,
  };
};

const getAccessToken = async (env: Env) => {
  if (!env.IGDB_CLIENT_ID || !env.IGDB_CLIENT_SECRET) {
    throw new Error('IGDB credentials are not configured');
  }

  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.value;
  }

  const url = new URL(TWITCH_TOKEN_URL);
  url.searchParams.set('client_id', env.IGDB_CLIENT_ID);
  url.searchParams.set('client_secret', env.IGDB_CLIENT_SECRET);
  url.searchParams.set('grant_type', 'client_credentials');

  const response = await fetch(url, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Twitch token error: ${response.status}`);
  }

  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token || !data.expires_in) {
    throw new Error('Twitch token response was incomplete');
  }

  tokenCache = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(data.expires_in - 300, 60) * 1000,
  };

  return tokenCache.value;
};

const fetchIgdb = async (env: Env, body: string, retry = true): Promise<IgdbGame[]> => {
  const token = await getAccessToken(env);
  const response = await fetch(`${IGDB_BASE_URL}/games`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Client-ID': env.IGDB_CLIENT_ID,
    },
    body,
  });

  if (response.status === 401 && retry) {
    tokenCache = null;
    return fetchIgdb(env, body, false);
  }

  if (!response.ok) {
    throw new Error(`IGDB API error: ${response.status}`);
  }

  return response.json();
};

const gameFields = [
  'id',
  'name',
  'slug',
  'summary',
  'first_release_date',
  'total_rating',
  'total_rating_count',
  'cover.image_id',
  'screenshots.image_id',
  'platforms.name',
  'genres.name',
  'websites.url',
  'videos.name',
  'videos.video_id',
].join(',');

const searchGames = async (env: Env, query: string) => {
  const body = [
    `search "${escapeIgdbString(query)}";`,
    `fields ${gameFields};`,
    'where version_parent = null;',
    'limit 20;',
  ].join(' ');

  const games = await fetchIgdb(env, body);
  return games.map(normalizeGame);
};

const getGameDetails = async (env: Env, id: number) => {
  const body = [
    `fields ${gameFields};`,
    `where id = ${id};`,
    'limit 1;',
  ].join(' ');

  const [game] = await fetchIgdb(env, body);
  return game ? normalizeGame(game) : null;
};

const withCache = async (
  request: Request,
  env: Env,
  ctx: ExecutionContextLike,
  seconds: number,
  resolver: () => Promise<Response>,
) => {
  const cache = caches.default;
  const cacheUrl = new URL(request.url);
  cacheUrl.searchParams.set('__origin', getCorsOrigin(request, env) || 'blocked');
  const cacheKey = new Request(cacheUrl.toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const response = await resolver();
  if (response.ok) {
    const cachedResponse = new Response(response.body, response);
    cachedResponse.headers.set('Cache-Control', `public, max-age=${seconds}`);
    ctx.waitUntil(cache.put(cacheKey, cachedResponse.clone()));
    return cachedResponse;
  }

  return response;
};

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContextLike): Promise<Response> {
    if (request.method === 'OPTIONS') {
      const origin = getCorsOrigin(request, env);
      return new Response(null, {
        status: origin ? 204 : 403,
        headers: corsHeaders(request, env),
      });
    }

    if (request.method !== 'GET') {
      return errorResponse(request, env, 405, 'Method not allowed');
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === '/api/games/search') {
        const query = (url.searchParams.get('q') || '').trim();
        if (query.length < 2) {
          return errorResponse(request, env, 400, 'Search query must be at least 2 characters');
        }

        return withCache(request, env, ctx, SEARCH_CACHE_SECONDS, async () => {
          const results = await searchGames(env, query);
          return jsonResponse(request, env, results);
        });
      }

      const detailsMatch = url.pathname.match(/^\/api\/games\/(\d+)$/);
      if (detailsMatch) {
        const id = Number(detailsMatch[1]);
        return withCache(request, env, ctx, DETAILS_CACHE_SECONDS, async () => {
          const game = await getGameDetails(env, id);
          if (!game) return errorResponse(request, env, 404, 'Game not found');
          return jsonResponse(request, env, game);
        });
      }

      return errorResponse(request, env, 404, 'Not found');
    } catch (error) {
      console.error(error);
      return errorResponse(request, env, 502, error instanceof Error ? error.message : 'Game API request failed');
    }
  },
};

export default worker;
