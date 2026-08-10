type RateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

type Env = {
  IGDB_CLIENT_ID: string;
  IGDB_CLIENT_SECRET: string;
  GG_DEALS_API_KEY: string;
  ALLOWED_ORIGINS?: string;
  ALLOW_ORIGINLESS_REQUESTS?: string;
  RATE_LIMITER: RateLimiter;
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

type IgdbExternalGame = {
  category?: number;
  uid?: string;
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
  external_games?: IgdbExternalGame[];
  videos?: { name?: string; video_id?: string }[];
};

type HltbInitResponse = {
  token?: string;
  [key: string]: string | undefined;
};

type HltbSearchGame = {
  game_id?: number;
  game_name?: string;
  game_alias?: string;
  game_type?: string;
  release_world?: string | number;
  comp_main?: number;
  comp_plus?: number;
  comp_100?: number;
  comp_all?: number;
};

type HltbSearchResponse = {
  data?: HltbSearchGame[];
};

type HltbCompletion = {
  hltb_id: number;
  hltb_url: string;
  playtime: number;
  playtime_main?: number;
  playtime_extra?: number;
  playtime_completionist?: number;
  playtime_all_styles?: number;
};

type HltbAuth = {
  token: string;
  key?: string;
  value?: string;
};

type TokenCache = {
  value: string;
  expiresAt: number;
};

type GgDealsGamePrices = {
  title?: unknown;
  url?: unknown;
  prices?: {
    currentRetail?: unknown;
    currentKeyshops?: unknown;
    historicalRetail?: unknown;
    historicalKeyshops?: unknown;
    currency?: unknown;
  };
};

type GgDealsResponse = {
  success?: boolean;
  data?: Record<string, GgDealsGamePrices | null>;
};

class GgDealsApiError extends Error {
  constructor(public status: number, public retryAfter?: string) {
    super(`GG.deals API error: ${status}`);
  }
}

const IGDB_BASE_URL = 'https://api.igdb.com/v4';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const HLTB_BASE_URL = 'https://howlongtobeat.com';
const GG_DEALS_PRICES_URL = 'https://api.gg.deals/v1/prices/by-steam-app-id/';
const HLTB_GAME_URL = `${HLTB_BASE_URL}/game`;
const HLTB_FALLBACK_SEARCH_PATH = '/api/s';
const HLTB_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const DEFAULT_ALLOWED_ORIGINS = ['https://tinykings.github.io', 'http://localhost:3000', 'http://127.0.0.1:3000'];
const SEARCH_CACHE_SECONDS = 60 * 60;
const DETAILS_CACHE_SECONDS = 60 * 60 * 24;
const PRICE_CACHE_SECONDS = 60 * 60;
const CACHE_VERSION = 'gg-prices-v2-game-media';
const MAX_URL_LENGTH = 2048;
const MAX_SEARCH_QUERY_LENGTH = 100;
const MAX_PRICE_IDS = 50;
const RATE_LIMIT_RETRY_SECONDS = 60;
const STEAM_EXTERNAL_GAME_CATEGORY = 1;
const GG_DEALS_REGIONS = new Set([
  'au', 'be', 'br', 'ca', 'ch', 'de', 'dk', 'es', 'eu', 'fi', 'fr', 'gb', 'ie', 'it', 'nl', 'no', 'pl', 'se', 'us',
]);

let tokenCache: TokenCache | null = null;
let hltbSearchPathCache: string | null = null;

const getAllowedOrigins = (env: Env) => {
  const configured = env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean);
  return [...new Set(configured?.length ? configured : DEFAULT_ALLOWED_ORIGINS)];
};

const allowsOriginlessRequests = (env: Env) => env.ALLOW_ORIGINLESS_REQUESTS?.toLowerCase() === 'true';

const getCorsOrigin = (request: Request, env: Env) => {
  const origin = request.headers.get('Origin');
  const allowedOrigins = getAllowedOrigins(env);

  if (allowedOrigins.includes('*')) return '*';
  if (!origin) return allowsOriginlessRequests(env) ? '*' : '';
  return allowedOrigins.includes(origin) ? origin : '';
};

const isRequestOriginAllowed = (request: Request, env: Env) => {
  const origin = request.headers.get('Origin');
  if (!origin) return allowsOriginlessRequests(env);
  return getAllowedOrigins(env).includes('*') || getAllowedOrigins(env).includes(origin);
};

const getClientKey = (request: Request) => request.headers.get('CF-Connecting-IP') || 'local';

const logSecurityEvent = (request: Request, event: string, details: Record<string, unknown> = {}) => {
  const url = new URL(request.url);
  console.warn(JSON.stringify({
    level: 'warn',
    event,
    method: request.method,
    path: url.pathname,
    origin: request.headers.get('Origin') || null,
    ray: request.headers.get('CF-Ray') || null,
    ...details,
  }));
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
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(request, env),
      ...init.headers,
    },
  });
};

const errorResponse = (request: Request, env: Env, status: number, error: string, headers: Record<string, string> = {}) => {
  return jsonResponse(request, env, { error }, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
};

const applyRateLimit = async (request: Request, env: Env, route: string) => {
  // Price quota belongs to one shared GG.deals key, so share its limiter within
  // each Cloudflare location. Other routes remain isolated per client.
  const key = route === 'prices' ? 'gg-deals:prices' : `${getClientKey(request)}:${route}`;
  const result = await env.RATE_LIMITER.limit({ key });
  return result.success;
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

const parsePositiveInteger = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const getSteamAppIdFromUrl = (value: string | undefined) => {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    if (url.hostname !== 'store.steampowered.com' && url.hostname !== 'www.store.steampowered.com') return undefined;
    return parsePositiveInteger(url.pathname.match(/^\/app\/(\d+)(?:\/|$)/)?.[1]);
  } catch {
    return undefined;
  }
};

export const getSteamAppId = (game: IgdbGame) => {
  const externalId = game.external_games
    ?.find((externalGame) => externalGame.category === STEAM_EXTERNAL_GAME_CATEGORY)
    ?.uid;
  const parsedExternalId = parsePositiveInteger(externalId);
  if (parsedExternalId) return parsedExternalId;

  for (const website of game.websites || []) {
    const websiteId = getSteamAppIdFromUrl(website.url);
    if (websiteId) return websiteId;
  }

  return undefined;
};

const normalizePrice = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? value : null;
};

const normalizeGgDealsUrl = (value: unknown) => {
  if (typeof value !== 'string') return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || (url.hostname !== 'gg.deals' && url.hostname !== 'www.gg.deals')) return null;
    return url.href;
  } catch {
    return null;
  }
};

export const normalizeGgDealsGamePrice = (steamAppId: number, game: GgDealsGamePrices | null | undefined) => {
  if (!game || typeof game.title !== 'string') return null;
  const url = normalizeGgDealsUrl(game.url);
  const currency = game.prices?.currency;
  if (!url || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return null;

  const currentRetail = normalizePrice(game.prices?.currentRetail);
  const currentKeyshops = normalizePrice(game.prices?.currentKeyshops);
  const historicalRetail = normalizePrice(game.prices?.historicalRetail);
  const historicalKeyshops = normalizePrice(game.prices?.historicalKeyshops);
  const retailAmount = currentRetail === null ? null : Number(currentRetail);
  const keyshopAmount = currentKeyshops === null ? null : Number(currentKeyshops);
  const lowestCurrent = retailAmount === null && keyshopAmount === null
    ? null
    : retailAmount !== null && (keyshopAmount === null || retailAmount <= keyshopAmount)
      ? { amount: currentRetail as string, source: 'retail' as const }
      : { amount: currentKeyshops as string, source: 'keyshop' as const };

  return {
    steamAppId,
    title: game.title,
    url,
    currency,
    currentRetail,
    currentKeyshops,
    historicalRetail,
    historicalKeyshops,
    lowestCurrent,
  };
};

const getGgDealsRetryAfter = (response: Response) => {
  const reset = Number(response.headers.get('x-ratelimit-reset'));
  if (Number.isFinite(reset)) {
    return String(Math.max(1, Math.ceil(reset - Date.now() / 1000)));
  }
  return response.headers.get('Retry-After') || String(RATE_LIMIT_RETRY_SECONDS);
};

const fetchSteamGamePrices = async (env: Env, steamAppIds: number[], region: string) => {
  if (!env.GG_DEALS_API_KEY) throw new Error('GG.deals API key is not configured');

  const url = new URL(GG_DEALS_PRICES_URL);
  url.searchParams.set('ids', steamAppIds.join(','));
  url.searchParams.set('key', env.GG_DEALS_API_KEY);
  url.searchParams.set('region', region);

  const response = await fetch(url);
  if (!response.ok) {
    throw new GgDealsApiError(response.status, response.status === 429 ? getGgDealsRetryAfter(response) : undefined);
  }

  const data = await response.json() as GgDealsResponse;
  if (!data.success || !data.data) throw new Error('GG.deals response was incomplete');
  return steamAppIds
    .map((steamAppId) => normalizeGgDealsGamePrice(steamAppId, data.data?.[String(steamAppId)]))
    .filter((price) => price !== null);
};

const fetchSteamGamePrice = async (env: Env, steamAppId: number, region: string) => {
  const [price] = await fetchSteamGamePrices(env, [steamAppId], region);
  return price || null;
};

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const getSearchTokens = (value: string) => normalizeSearchText(value).split(' ').filter(Boolean);

const getBigrams = (value: string) => {
  const normalized = normalizeSearchText(value).replace(/\s+/g, '');
  if (normalized.length < 2) return normalized ? [normalized] : [];

  const bigrams: string[] = [];
  for (let index = 0; index < normalized.length - 1; index += 1) {
    bigrams.push(normalized.slice(index, index + 2));
  }
  return bigrams;
};

const getDiceSimilarity = (a: string, b: string) => {
  const aNormalized = normalizeSearchText(a);
  const bNormalized = normalizeSearchText(b);
  if (!aNormalized || !bNormalized) return 0;
  if (aNormalized === bNormalized) return 1;

  const aBigrams = getBigrams(aNormalized);
  const bBigrams = getBigrams(bNormalized);
  if (aBigrams.length === 0 || bBigrams.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const bigram of aBigrams) counts.set(bigram, (counts.get(bigram) || 0) + 1);

  let intersections = 0;
  for (const bigram of bBigrams) {
    const count = counts.get(bigram) || 0;
    if (count > 0) {
      intersections += 1;
      counts.set(bigram, count - 1);
    }
  }

  return (2 * intersections) / (aBigrams.length + bBigrams.length);
};

const getTokenCoverage = (queryTokens: string[], candidateTokens: string[]) => {
  if (queryTokens.length === 0 || candidateTokens.length === 0) return 0;
  const candidateSet = new Set(candidateTokens);
  const matches = queryTokens.filter((token) => candidateSet.has(token)).length;
  return matches / queryTokens.length;
};

const secondsToHours = (seconds: number | undefined) => {
  if (!seconds || seconds <= 0) return undefined;
  return Number((seconds / 3600).toFixed(1));
};

const getReleaseYear = (game: IgdbGame) => {
  const releaseDate = dateFromUnixSeconds(game.first_release_date);
  return releaseDate ? releaseDate.split('-')[0] : undefined;
};

const scoreHltbMatch = (candidate: HltbSearchGame, title: string, releaseYear?: string) => {
  const query = normalizeSearchText(title);
  const queryTokens = getSearchTokens(title);
  const candidateTitle = normalizeSearchText(candidate.game_name || '');
  const candidateAlias = normalizeSearchText(candidate.game_alias || '');
  const candidateTokens = getSearchTokens(candidate.game_name || '');
  const aliasTokens = getSearchTokens(candidate.game_alias || '');
  const candidateYear = candidate.release_world ? String(candidate.release_world) : '';

  if (!candidate.game_id || !candidateTitle) return Number.NEGATIVE_INFINITY;

  const similarity = Math.max(
    getDiceSimilarity(query, candidateTitle),
    getDiceSimilarity(query, candidateAlias),
    getTokenCoverage(queryTokens, candidateTokens),
    getTokenCoverage(queryTokens, aliasTokens),
  );
  let score = similarity * 100;

  if (candidateTitle === query) score += 30;
  else if (candidateAlias === query) score += 25;
  else if (candidateTitle.includes(query) || query.includes(candidateTitle)) score += 12;
  else if (candidateAlias && (candidateAlias.includes(query) || query.includes(candidateAlias))) score += 10;

  if (candidate.game_type && !['game', 'multi'].includes(candidate.game_type)) score -= 20;

  if (releaseYear && candidateYear === releaseYear) score += 10;
  if (candidate.comp_main || candidate.comp_all || candidate.comp_plus || candidate.comp_100) score += 5;

  return score;
};

const getBestHltbMatch = (items: HltbSearchGame[], title: string, releaseYear?: string) => {
  const [best] = [...items]
    .map((item) => ({ item, score: scoreHltbMatch(item, title, releaseYear) }))
    .filter(({ score }) => score >= 45)
    .sort((a, b) => b.score - a.score);

  return best?.item || null;
};

const buildHltbCompletion = (match: HltbSearchGame): HltbCompletion | null => {
  const hltbId = match.game_id;
  const mainStory = secondsToHours(match.comp_main);
  const mainExtra = secondsToHours(match.comp_plus);
  const completionist = secondsToHours(match.comp_100);
  const allStyles = secondsToHours(match.comp_all);
  const playtime = mainStory || allStyles || mainExtra || completionist;
  if (!hltbId || !playtime) return null;

  return {
    hltb_id: hltbId,
    hltb_url: `${HLTB_GAME_URL}/${hltbId}`,
    playtime,
    ...(mainStory ? { playtime_main: mainStory } : {}),
    ...(mainExtra ? { playtime_extra: mainExtra } : {}),
    ...(completionist ? { playtime_completionist: completionist } : {}),
    ...(allStyles ? { playtime_all_styles: allStyles } : {}),
  };
};

const fetchWithTimeout = async (url: string, init: RequestInit = {}, timeoutMs = 5000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: init.signal || controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const getHltbHeaders = (auth?: HltbAuth) => {
  const headers: Record<string, string> = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': HLTB_BASE_URL,
    'Referer': `${HLTB_BASE_URL}/`,
    'User-Agent': HLTB_USER_AGENT,
  };

  if (auth) {
    headers['x-auth-token'] = auth.token;
    if (auth.key) headers['x-hp-key'] = auth.key;
    if (auth.value) headers['x-hp-val'] = auth.value;
  }

  return headers;
};

const getHltbScriptSources = (html: string, parseAllScripts: boolean) => {
  const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1])
    .filter(Boolean);
  return parseAllScripts ? scripts : scripts.filter((src) => src.includes('_app-'));
};

const extractHltbSearchPath = (scriptContent: string) => {
  const match = scriptContent.match(/fetch\s*\(\s*["']\/api\/([a-zA-Z0-9_/]+)[^"']*["']\s*,\s*{[^}]*method:\s*["']POST["'][^}]*}/is);
  if (!match?.[1]) return null;

  const [basePath] = match[1].split('/');
  return basePath ? `/api/${basePath}` : null;
};

const discoverHltbSearchPath = async (parseAllScripts: boolean) => {
  const homeResponse = await fetchWithTimeout(`${HLTB_BASE_URL}/`, { headers: getHltbHeaders() });
  if (!homeResponse.ok) return null;

  const homeHtml = await homeResponse.text();
  for (const scriptSrc of getHltbScriptSources(homeHtml, parseAllScripts)) {
    const scriptUrl = new URL(scriptSrc, `${HLTB_BASE_URL}/`).href;
    const scriptResponse = await fetchWithTimeout(scriptUrl, { headers: getHltbHeaders() });
    if (!scriptResponse.ok) continue;

    const searchPath = extractHltbSearchPath(await scriptResponse.text());
    if (searchPath) return searchPath;
  }

  return null;
};

const getHltbSearchPath = async () => {
  if (hltbSearchPathCache) return hltbSearchPathCache;

  hltbSearchPathCache = (await discoverHltbSearchPath(false)) || (await discoverHltbSearchPath(true)) || HLTB_FALLBACK_SEARCH_PATH;
  return hltbSearchPathCache;
};

const extractHltbAuth = (initData: HltbInitResponse): HltbAuth | null => {
  if (!initData.token) return null;

  let key: string | undefined;
  let value: string | undefined;
  for (const [fieldName, fieldValue] of Object.entries(initData)) {
    const lower = fieldName.toLowerCase();
    if (lower.includes('key')) key = fieldValue;
    if (lower.includes('val')) value = fieldValue;
  }

  return {
    token: initData.token,
    key,
    value,
  };
};

const getHltbAuth = async (searchPath: string) => {
  const initUrl = new URL(`${searchPath.replace(/\/$/, '')}/init`, `${HLTB_BASE_URL}/`);
  initUrl.searchParams.set('t', String(Date.now()));

  const initResponse = await fetchWithTimeout(initUrl.href, { headers: getHltbHeaders() });
  if (!initResponse.ok) return null;

  return extractHltbAuth(await initResponse.json() as HltbInitResponse);
};

const fetchHowLongToBeat = async (game: IgdbGame): Promise<HltbCompletion | null> => {
  const title = game.name?.trim();
  if (!title) return null;

  try {
    const searchPath = await getHltbSearchPath();
    const auth = await getHltbAuth(searchPath);
    if (!auth) return null;

    const payload: Record<string, unknown> = {
      searchType: 'games',
      searchTerms: title.split(/\s+/).filter(Boolean),
      searchPage: 1,
      size: 20,
      searchOptions: {
        games: {
          userId: 0,
          platform: '',
          sortCategory: 'popular',
          rangeCategory: 'main',
          rangeTime: { min: 0, max: 0 },
          gameplay: {
            perspective: '',
            flow: '',
            genre: '',
            difficulty: '',
          },
          rangeYear: { min: '', max: '' },
          modifier: 'hide_dlc',
        },
        users: { sortCategory: 'postcount' },
        lists: { sortCategory: 'follows' },
        filter: '',
        sort: 0,
        randomizer: 0,
      },
      useCache: true,
    };

    if (auth.key && auth.value) {
      payload[auth.key] = auth.value;
    }

    const searchUrl = new URL(searchPath, `${HLTB_BASE_URL}/`).href;
    const searchResponse = await fetchWithTimeout(searchUrl, {
      method: 'POST',
      headers: {
        ...getHltbHeaders(auth),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!searchResponse.ok) return null;

    const searchData = await searchResponse.json() as HltbSearchResponse;
    const match = getBestHltbMatch(searchData.data || [], title, getReleaseYear(game));
    return match ? buildHltbCompletion(match) : null;
  } catch (error) {
    console.error('HowLongToBeat request failed:', error);
    return null;
  }
};

const normalizeGame = (game: IgdbGame, hltbCompletion?: HltbCompletion | null, hltbChecked = false) => {
  const screenshots = (game.screenshots || [])
    .map((image) => imageUrl(image.image_id, 'screenshot_big_2x'))
    .filter((url): url is string => !!url);
  const poster = imageUrl(game.cover?.image_id, 'cover_big_2x') || screenshots[0] || null;
  const slug = game.slug || '';
  const videos = (game.videos || [])
    .filter((video) => video.video_id)
    .slice(0, 3)
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
    steam_app_id: getSteamAppId(game),
    screenshots: screenshots.slice(0, 3),
    videos,
    source_url: slug ? `https://www.igdb.com/games/${slug}` : undefined,
    ...(hltbChecked ? { hltb_checked_at: Date.now() } : {}),
    ...(hltbCompletion || {}),
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
  'external_games.category',
  'external_games.uid',
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
  return games.map((game) => normalizeGame(game));
};

const getGameDetails = async (env: Env, id: number) => {
  const body = [
    `fields ${gameFields};`,
    `where id = ${id};`,
    'limit 1;',
  ].join(' ');

  const [game] = await fetchIgdb(env, body);
  if (!game) return null;

  const hltbCompletion = await fetchHowLongToBeat(game);
  return normalizeGame(game, hltbCompletion, true);
};

const withCache = async (
  request: Request,
  env: Env,
  ctx: ExecutionContextLike,
  seconds: number,
  resolver: () => Promise<Response>,
) => {
  const cache = (caches as CacheStorage & { default: Cache }).default;
  const cacheUrl = new URL(request.url);
  cacheUrl.searchParams.set('__origin', getCorsOrigin(request, env) || 'blocked');
  cacheUrl.searchParams.set('__version', CACHE_VERSION);
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
    if (!isRequestOriginAllowed(request, env)) {
      logSecurityEvent(request, 'request_origin_blocked');
      return errorResponse(request, env, 403, 'Origin not allowed');
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env),
      });
    }

    if (request.method !== 'GET') {
      return errorResponse(request, env, 405, 'Method not allowed', { Allow: 'GET, OPTIONS' });
    }

    if (request.url.length > MAX_URL_LENGTH) {
      logSecurityEvent(request, 'request_url_too_long', { length: request.url.length });
      return errorResponse(request, env, 414, 'Request URL is too long');
    }

    const url = new URL(request.url);
    const route = url.pathname === '/api/games/search'
      ? 'search'
      : url.pathname.startsWith('/api/games/')
        ? 'details'
        : (url.pathname === '/api/prices/steam' || url.pathname.startsWith('/api/prices/steam/'))
          ? 'prices'
          : 'other';

    try {
      if (!await applyRateLimit(request, env, route)) {
        logSecurityEvent(request, 'request_rate_limited', { route });
        return errorResponse(request, env, 429, 'Too many requests', {
          'Retry-After': String(RATE_LIMIT_RETRY_SECONDS),
        });
      }

      if (url.pathname === '/api/games/search') {
        const unexpectedParameters = [...url.searchParams.keys()].filter((key) => key !== 'q');
        if (unexpectedParameters.length > 0) {
          return errorResponse(request, env, 400, 'Unsupported query parameter');
        }

        const query = (url.searchParams.get('q') || '').trim();
        if (query.length < 2) {
          return errorResponse(request, env, 400, 'Search query must be at least 2 characters');
        }
        if (query.length > MAX_SEARCH_QUERY_LENGTH) {
          return errorResponse(request, env, 400, `Search query must not exceed ${MAX_SEARCH_QUERY_LENGTH} characters`);
        }

        return withCache(request, env, ctx, SEARCH_CACHE_SECONDS, async () => {
          const results = await searchGames(env, query);
          return jsonResponse(request, env, results);
        });
      }

      if (url.pathname === '/api/prices/steam') {
        const unexpectedParameters = [...url.searchParams.keys()].filter((key) => key !== 'ids' && key !== 'region');
        if (unexpectedParameters.length > 0) {
          return errorResponse(request, env, 400, 'Unsupported query parameter');
        }

        const rawIds = url.searchParams.get('ids') || '';
        const idParts = rawIds.split(',');
        if (!rawIds || idParts.some((id) => !/^\d+$/.test(id))) {
          return errorResponse(request, env, 400, 'Invalid Steam App IDs');
        }
        const steamAppIds = [...new Set(idParts.map(parsePositiveInteger))];
        if (steamAppIds.some((id) => !id) || steamAppIds.length > MAX_PRICE_IDS) {
          return errorResponse(request, env, 400, `Provide between 1 and ${MAX_PRICE_IDS} Steam App IDs`);
        }
        const region = (url.searchParams.get('region') || 'us').toLowerCase();
        if (!GG_DEALS_REGIONS.has(region)) return errorResponse(request, env, 400, 'Unsupported GG.deals region');

        return withCache(request, env, ctx, PRICE_CACHE_SECONDS, async () => {
          const prices = await fetchSteamGamePrices(env, steamAppIds as number[], region);
          return jsonResponse(request, env, prices);
        });
      }

      const priceMatch = url.pathname.match(/^\/api\/prices\/steam\/(\d+)$/);
      if (priceMatch) {
        const unexpectedParameters = [...url.searchParams.keys()].filter((key) => key !== 'region');
        if (unexpectedParameters.length > 0) {
          return errorResponse(request, env, 400, 'Unsupported query parameter');
        }

        const steamAppId = parsePositiveInteger(priceMatch[1]);
        if (!steamAppId) return errorResponse(request, env, 400, 'Invalid Steam App ID');
        const region = (url.searchParams.get('region') || 'us').toLowerCase();
        if (!GG_DEALS_REGIONS.has(region)) return errorResponse(request, env, 400, 'Unsupported GG.deals region');

        return withCache(request, env, ctx, PRICE_CACHE_SECONDS, async () => {
          const price = await fetchSteamGamePrice(env, steamAppId, region);
          return jsonResponse(request, env, price);
        });
      }

      const detailsMatch = url.pathname.match(/^\/api\/games\/(\d+)$/);
      if (detailsMatch) {
        if ([...url.searchParams.keys()].length > 0) {
          return errorResponse(request, env, 400, 'Query parameters are not supported for game details');
        }

        const id = Number(detailsMatch[1]);
        if (!Number.isSafeInteger(id) || id <= 0) {
          return errorResponse(request, env, 400, 'Invalid game ID');
        }

        return withCache(request, env, ctx, DETAILS_CACHE_SECONDS, async () => {
          const game = await getGameDetails(env, id);
          if (!game) return errorResponse(request, env, 404, 'Game not found');
          return jsonResponse(request, env, game);
        });
      }

      return errorResponse(request, env, 404, 'Not found');
    } catch (error) {
      if (error instanceof GgDealsApiError && error.status === 429) {
        logSecurityEvent(request, 'gg_deals_rate_limited', { route });
        return errorResponse(request, env, 429, 'Price service rate limit reached', {
          'Retry-After': error.retryAfter || String(RATE_LIMIT_RETRY_SECONDS),
        });
      }

      console.error(JSON.stringify({
        level: 'error',
        event: 'game_api_request_failed',
        path: url.pathname,
        ray: request.headers.get('CF-Ray') || null,
        message: error instanceof Error ? error.message : 'Game API request failed',
      }));
      return errorResponse(request, env, 502, 'Game API request failed');
    }
  },
};

export default worker;
