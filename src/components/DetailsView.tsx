'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { getMediaDetails, getWatchProviders, getImageUrl, getContentRating, getSeasonDetails, getMediaVideos } from '@/lib/tmdb';
import { checkVidAngelAvailability } from '@/lib/vidangel';
import { Media, WatchProvidersResponse, WatchProvider, SeasonDetails, Video, SeasonSummary } from '@/lib/types';
import { ChevronLeft, Plus, Check, Trash2, Play, Star, Calendar, ShieldCheck, ChevronDown, Skull } from 'lucide-react';
import { clsx } from 'clsx';

export default function DetailsView() {
  const searchParams = useSearchParams();
  const type = searchParams.get('type') as 'movie' | 'tv';
  const id = searchParams.get('id');
  const router = useRouter();
  const { 
    apiKey, 
    watchlist, 
    watched, 
    toggleWatchlist, 
    toggleWatched, 
    vidAngelEnabled,
    externalPlayerEnabled,
    selectedExternalPlayer,
  } = useAppContext();

  const [media, setMedia] = useState<Media | null>(null);
  const [rating, setRating] = useState<string | null>(null);
  const [providers, setProviders] = useState<WatchProvidersResponse | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [vidAngelSlug, setVidAngelSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number>(1);
  const [seasonDetails, setSeasonDetails] = useState<SeasonDetails | null>(null);

  useEffect(() => {
    setSelectedSeasonNumber(1);
    setSeasonDetails(null);
  }, [id]);

  useEffect(() => {
    if (media?.media_type === 'tv' && apiKey) {
       getSeasonDetails(media.id, selectedSeasonNumber, apiKey)
         .then(setSeasonDetails)
         .catch(console.error);
    }
  }, [media, selectedSeasonNumber, apiKey]);

  useEffect(() => {
    if (apiKey && id && type) {
      setLoading(true);

      const checkVA = async (currentRating: string | null, title: string): Promise<string | null> => {
        if (!vidAngelEnabled || !currentRating) return null;
        if ((type === 'movie' && currentRating === 'R') || (type === 'tv' && currentRating === 'TV-MA')) {
           return checkVidAngelAvailability(title, parseInt(id!));
        }
        return null;
      };

      Promise.all([
        getMediaDetails(parseInt(id), type, apiKey),
        getWatchProviders(parseInt(id), type, apiKey),
        getContentRating(parseInt(id), type, apiKey),
        getMediaVideos(parseInt(id), type, apiKey)
      ])
        .then(async ([mediaData, providerData, ratingData, videoData]) => {
          if (mediaData.media_type === 'tv' && mediaData.seasons && mediaData.seasons.length > 0) {
            const regularSeasons = mediaData.seasons.filter((s: SeasonSummary) => s.season_number > 0);
            const latestSeason = regularSeasons.length > 0 
              ? regularSeasons[regularSeasons.length - 1].season_number 
              : mediaData.seasons[mediaData.seasons.length - 1].season_number;
            setSelectedSeasonNumber(latestSeason);
          }

          setMedia(mediaData);
          setProviders(providerData);
          setRating(ratingData);
          
          const trailers = videoData.results
            .filter((v: Video) => v.site === 'YouTube' && v.type === 'Trailer')
            .sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime())
            .slice(0, 2);
          setVideos(trailers);

          const slug = await checkVA(ratingData, mediaData.title || mediaData.name || '');
          setVidAngelSlug(slug);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    } else if (!apiKey) {
       if (id && type) setLoading(false); 
    }
  }, [id, type, apiKey, vidAngelEnabled]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  if (error || !media) return (
    <div className="p-8 text-center">
      <p className="text-red-500 mb-4">{error || 'Media not found'}</p>
      <button onClick={() => router.push('/')} className="text-indigo-600 font-bold">Go Back</button>
    </div>
  );

  const inWatchlist = watchlist.some((m) => m.id === media.id && m.media_type === media.media_type);
  const inWatched = watched.some((m) => m.id === media.id && m.media_type === media.media_type);
  const vidAngelAvailable = !!vidAngelSlug;

  const title = media.title || media.name;
  const year = (media.release_date || media.first_air_date)?.split('-')[0];
  const userRegion = 'US'; 
  const localProviders = providers?.results?.[userRegion];

  const getExternalPlayerUrl = (mediaType: 'movie' | 'tv', mediaId: number, seasonNum?: number, episodeNum?: number) => {
    if (!externalPlayerEnabled || !selectedExternalPlayer) return '';
    let url = '';
    if (mediaType === 'movie' && selectedExternalPlayer.movieUrlTemplate) {
      url = selectedExternalPlayer.movieUrlTemplate.replace('{TMDBID}', mediaId.toString());
    } else if (mediaType === 'tv' && selectedExternalPlayer.tvUrlTemplate && seasonNum !== undefined && episodeNum !== undefined) {
      url = selectedExternalPlayer.tvUrlTemplate
        .replace('{TMDBID}', mediaId.toString())
        .replace('{season_num}', seasonNum.toString())
        .replace('{episode_num}', episodeNum.toString());
    }
    return url;
  };

  return (
    <div className="pb-4">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 relative z-10">
        <button
          onClick={() => router.push('/')}
          className="mb-4 inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <ChevronLeft size={20} />
          <span className="font-medium">Back</span>
        </button>
        
        <div className="flex flex-col md:flex-row md:items-start gap-6 mb-8">
          <div className="w-32 md:w-48 aspect-[2/3] rounded-lg overflow-hidden shadow-2xl border-2 border-white dark:border-gray-800 shrink-0 bg-gray-200 dark:bg-gray-800 mb-2 mx-auto md:mx-0">
            {media.poster_path && (
              <img src={getImageUrl(media.poster_path)} alt={title} className="w-full h-full object-cover" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-4xl font-black leading-tight mb-2 text-gray-900 dark:text-white text-center md:text-left">{title}</h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs md:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <span className="flex items-center gap-1"><Calendar size={14} /> {year}</span>
              <span className="flex items-center gap-1"><Star size={14} className="text-yellow-500 fill-yellow-500" /> {media.vote_average.toFixed(1)}</span>
              <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded uppercase">{media.media_type}</span>
              {rating && (
                <span className="bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded border border-black/5 dark:border-white/5">{rating}</span>
              )}
            </div>

            <div className="flex flex-col gap-3 mt-6">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => toggleWatchlist(media)}
                  className={clsx(
                    "flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 text-sm",
                    inWatchlist
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
                      : "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                  )}
                >
                  {inWatchlist ? <Trash2 size={18} /> : <Plus size={18} />}
                  <span>{inWatchlist ? 'Remove' : 'Watchlist'}</span>
                </button>

                <button
                  onClick={() => toggleWatched(media)}
                  className={clsx(
                    "flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 text-sm border-2",
                    inWatched
                      ? "bg-green-100 dark:bg-green-900/30 border-green-100 dark:border-green-900/30 text-green-700 dark:text-green-300"
                      : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                >
                  <Check size={18} />
                  <span>{inWatched ? 'Watched' : 'Mark Watched'}</span>
                </button>
              </div>

              {(externalPlayerEnabled && selectedExternalPlayer && media.media_type === 'movie') || vidAngelAvailable ? (
                <div className="flex gap-3">
                  {externalPlayerEnabled && selectedExternalPlayer && media.media_type === 'movie' && (
                    <a
                      href={getExternalPlayerUrl('movie', media.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 text-sm bg-rose-600 text-white shadow-lg shadow-rose-200 dark:shadow-none hover:bg-rose-700 dark:bg-rose-500"
                    >
                      <Play size={18} className="fill-white" />
                      <span>Play</span>
                    </a>
                  )}

                  {vidAngelAvailable && (
                    <a
                      href={`https://www.vidangel.com/${media.media_type === 'movie' ? 'movie' : 'show'}/${vidAngelSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 text-sm bg-amber-500 text-white shadow-lg shadow-amber-200 dark:shadow-none hover:bg-amber-600"
                    >
                      <ShieldCheck size={18} />
                      <span>Edit</span>
                    </a>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-bold mb-2 uppercase tracking-tighter italic text-gray-900 dark:text-white">Overview</h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg mb-4">
            {media.overview || 'No overview available.'}
          </p>
          
          {localProviders?.flatrate && localProviders.flatrate.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {localProviders.flatrate.map((p) => (
                <ProviderIcon key={p.provider_id} provider={p} />
              ))}
            </div>
          )}
        </section>

        {media.media_type === 'tv' && media.seasons && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold uppercase tracking-tighter italic text-gray-900 dark:text-white">Episodes</h2>
              <div className="relative">
                <select
                  value={selectedSeasonNumber}
                  onChange={(e) => setSelectedSeasonNumber(Number(e.target.value))}
                  className="appearance-none bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-bold py-2 pl-4 pr-10 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {media.seasons.map((s) => (
                    <option key={s.id} value={s.season_number}>{s.name}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-4">
              {seasonDetails ? seasonDetails.episodes.map((ep) => (
                <div key={ep.id} className="flex gap-3 p-3 sm:p-4 sm:gap-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                  <div className="w-24 sm:w-32 aspect-video rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800 shrink-0 relative">
                    {ep.still_path ? (
                      <img src={getImageUrl(ep.still_path)} alt={ep.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Play size={24} />
                      </div>
                    )}
                    <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[8px] sm:text-[10px] font-bold px-1 rounded">
                      S{ep.season_number} E{ep.episode_number}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 py-0.5 sm:py-1">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-0.5 sm:gap-4 mb-1">
                      <h3 className="font-bold text-gray-900 dark:text-white truncate text-sm sm:text-base" title={ep.name}>{ep.name}</h3>
                      <span className="text-[10px] sm:text-xs font-medium text-gray-500 whitespace-nowrap">
                        {ep.air_date ? new Date(ep.air_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'TBA'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {ep.overview || 'No overview available.'}
                    </p>
                  </div>
                  {externalPlayerEnabled && selectedExternalPlayer && (
                    <a
                      href={getExternalPlayerUrl('tv', media.id, ep.season_number, ep.episode_number)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Play S${ep.season_number} E${ep.episode_number} on ${selectedExternalPlayer.name}`}
                      className="shrink-0 p-2 self-center text-gray-400 hover:text-rose-600 transition-colors"
                    >
                      <Skull size={20} />
                    </a>
                  )}
                </div>
              )) : (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400 animate-pulse">Loading episodes...</div>
              )}
            </div>
          </section>
        )}

        {videos.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold mb-4 uppercase tracking-tighter italic text-gray-900 dark:text-white">Trailers</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {videos.map((video) => (
                <div key={video.id} className="aspect-video rounded-xl overflow-hidden bg-black shadow-lg border border-gray-100 dark:border-gray-800">
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${video.key}`}
                    title={video.name}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const ProviderIcon = ({ provider }: { provider: WatchProvider }) => (
  <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
    <img src={getImageUrl(provider.logo_path)} alt={provider.provider_name} className="w-full h-full object-cover" />
  </div>
);