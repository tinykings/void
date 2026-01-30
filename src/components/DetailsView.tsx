'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { getMediaDetails, getWatchProviders, getImageUrl, getContentRating, getSeasonDetails, getMediaVideos, getMediaCredits, getPersonCredits } from '@/lib/tmdb';
import { checkVidAngelAvailability } from '@/lib/vidangel';
import { Media, WatchProvidersResponse, WatchProvider, SeasonDetails, Video, SeasonSummary, CastMember } from '@/lib/types';
import { ChevronLeft, Plus, Check, Trash2, Play, Star, Calendar, ShieldCheck, ChevronDown, User as UserIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { CreditsModal } from '@/components/CreditsModal';

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
  const [cast, setCast] = useState<CastMember[]>([]);
  const [vidAngelSlug, setVidAngelSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number>(1);
  const [seasonDetails, setSeasonDetails] = useState<SeasonDetails | null>(null);

  // Credits Modal State
  const [selectedActor, setSelectedActor] = useState<CastMember | null>(null);
  const [actorCredits, setActorCredits] = useState<Media[]>([]);
  const [isCreditsModalOpen, setIsCreditsModalOpen] = useState(false);
  const [creditsLoading, setCreditsLoading] = useState(false);

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'info';
    confirmText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info',
    confirmText: 'Confirm'
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    setSelectedSeasonNumber(1);
    setSeasonDetails(null);

    // Set immersive theme color for Details
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#000000');

    return () => {
      // Revert to Home theme color on unmount
      if (meta) meta.setAttribute('content', '#030712');
    };
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
        getMediaVideos(parseInt(id), type, apiKey),
        getMediaCredits(parseInt(id), type, apiKey)
      ])
        .then(async ([mediaData, providerData, ratingData, videoData, creditsData]) => {
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
          setCast(creditsData.cast.slice(0, 4));
          
          const trailers = videoData.results
            .filter((v: Video) => v.site === 'YouTube' && v.type === 'Trailer')
            .sort((a: Video, b: Video) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime())
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
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-cyan shadow-[0_0_15px_rgba(34,211,238,0.2)]"></div>
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

  const handleWatchlistToggle = () => {
    if (inWatchlist) {
      setModalConfig({
        isOpen: true,
        title: 'Remove from List',
        message: `Are you sure you want to remove "${title}" from your watchlist?`,
        type: 'danger',
        confirmText: 'Remove',
        onConfirm: () => {
          toggleWatchlist(media);
          toast.success('Removed from watchlist');
        }
      });
    } else {
      toggleWatchlist(media);
      toast.success('Added to watchlist');
    }
  };

  const handleWatchedToggle = () => {
    if (inWatched) {
      setModalConfig({
        isOpen: true,
        title: 'Remove from History',
        message: `Remove "${title}" from your history?`,
        type: 'danger',
        confirmText: 'Remove',
        onConfirm: () => {
          toggleWatched(media);
          toast.success('Removed from history');
        }
      });
    } else {
      setModalConfig({
        isOpen: true,
        title: 'Mark as Watched',
        message: `Add "${title}" to your watched history?`,
        type: 'info',
        confirmText: 'Mark Watched',
        onConfirm: () => {
          toggleWatched(media);
          toast.success('Marked as watched');
        }
      });
    }
  };

  const handleActorClick = async (actor: CastMember) => {
    if (!apiKey) return;
    setSelectedActor(actor);
    setIsCreditsModalOpen(true);
    setCreditsLoading(true);
    try {
      const data = await getPersonCredits(actor.id, apiKey);
      
      // Filter out duplicates and invalid entries
      const seen = new Set();
      const uniqueCredits = data.cast.filter((c: any) => {
        const key = `${c.media_type || 'movie'}-${c.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const sortedCredits = uniqueCredits
        .sort((a: any, b: any) => (b.vote_count || 0) - (a.vote_count || 0))
        .slice(0, 24)
        .map((c: any) => ({ ...c, media_type: c.media_type || 'movie' } as Media));
      setActorCredits(sortedCredits);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load actor credits');
    } finally {
      setCreditsLoading(false);
    }
  };

  const getExternalPlayerUrl = (mediaType: 'movie' | 'tv', mediaId: number, seasonNum?: number, episodeNum?: number) => {
    if (!externalPlayerEnabled || !selectedExternalPlayer) return '';
    let url = '';
    if (mediaType === 'movie' && selectedExternalPlayer.movieUrlTemplate) {
      url = selectedExternalPlayer.movieUrlTemplate.replace('{TMDBID}', mediaId.toString());
    } else if (mediaType === 'tv') {
      if (seasonNum !== undefined && episodeNum !== undefined) {
        if (selectedExternalPlayer.tvUrlTemplate) {
          url = selectedExternalPlayer.tvUrlTemplate
            .replace('{TMDBID}', mediaId.toString())
            .replace('{season_num}', seasonNum.toString())
            .replace('{episode_num}', episodeNum.toString());
        }
      } else if (selectedExternalPlayer.seriesUrlTemplate) {
        url = selectedExternalPlayer.seriesUrlTemplate.replace('{TMDBID}', mediaId.toString());
      } else if (selectedExternalPlayer.movieUrlTemplate) {
        // Series level link fallback: formatted like movie but /tv/ and no ?play=true
        url = selectedExternalPlayer.movieUrlTemplate
          .replace('{TMDBID}', mediaId.toString())
          .replace('/movie/', '/tv/')
          .replace('?play=true', '');
      }
    }
    return url;
  };

  return (
    <div className="pb-4">
      {/* Cinematic Backdrop */}
      <div className="relative w-full h-[30vh] md:h-[45vh] overflow-hidden bg-brand-bg">
        {media.backdrop_path ? (
          <>
            <img 
              src={getImageUrl(media.backdrop_path, 'w780')} 
              alt="" 
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-bg via-transparent to-transparent" />
          </>
        ) : (
          <div className="w-full h-full bg-brand-cyan/10" />
        )}
        
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 px-4 py-2 glass-effect rounded-xl text-white font-bold shadow-xl hover:bg-brand-bg transition-all active:scale-95"
          >
            <ChevronLeft size={20} />
            <span>Back</span>
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-12 md:-mt-16 relative z-10">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-5xl font-black leading-tight mb-4 text-white drop-shadow-[0_0_15px_rgba(34,211,238,0.2)] uppercase italic tracking-tighter">{title}</h1>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs md:text-sm font-bold text-brand-silver uppercase tracking-wider">
              <span className="flex items-center gap-1"><Calendar size={14} /> {year}</span>
              <span className="flex items-center gap-1"><Star size={14} className="text-brand-cyan fill-brand-cyan" /> {media.vote_average.toFixed(1)}</span>
              <span className="bg-brand-bg/50 blueprint-border px-2 py-0.5 rounded uppercase">{media.media_type}</span>
              {rating && (
                <span className="bg-brand-bg/50 blueprint-border px-2 py-0.5 rounded border border-white/5">{rating}</span>
              )}
            </div>

            {media.next_episode_to_air && (
              <div className="mt-4 px-4 py-2 bg-brand-cyan/10 blueprint-border rounded-xl inline-block mx-auto md:mx-0">
                <p className="text-xs md:text-sm font-bold text-brand-cyan">
                  NEXT EPISODE: {new Date(media.next_episode_to_air.air_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  <span className="ml-2 opacity-75 font-medium">(S{media.next_episode_to_air.season_number} E{media.next_episode_to_air.episode_number})</span>
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 mt-6">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleWatchlistToggle}
                  className={clsx(
                    "flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 text-sm",
                    inWatchlist
                      ? "bg-brand-bg/80 blueprint-border text-white hover:bg-brand-bg"
                      : "bg-brand-cyan text-brand-bg shadow-lg shadow-brand-cyan/20 hover:bg-brand-cyan/90"
                  )}
                >
                  {inWatchlist ? <Trash2 size={18} /> : <Plus size={18} />}
                  <span>{inWatchlist ? 'Remove' : 'Watchlist'}</span>
                </button>

                <button
                  onClick={handleWatchedToggle}
                  className={clsx(
                    "flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 text-sm",
                    inWatched
                      ? "bg-green-500/20 blueprint-border text-green-400"
                      : "bg-brand-bg/50 blueprint-border text-brand-silver hover:bg-brand-bg hover:text-white"
                  )}
                >
                  <Check size={18} />
                  <span>{inWatched ? 'Watched' : 'Mark Watched'}</span>
                </button>
              </div>

              {(externalPlayerEnabled && selectedExternalPlayer) || vidAngelAvailable ? (
                <div className="flex gap-3">
                  {externalPlayerEnabled && selectedExternalPlayer && (
                    <a
                      href={getExternalPlayerUrl(media.media_type, media.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 text-sm bg-brand-cyan text-brand-bg shadow-lg shadow-brand-cyan/20 hover:bg-brand-cyan/90"
                    >
                      <Play size={18} className="fill-brand-bg" />
                      <span>Play</span>
                    </a>
                  )}

                  {vidAngelAvailable && (
                    <a
                      href={`https://www.vidangel.com/${media.media_type === 'movie' ? 'movie' : 'show'}/${vidAngelSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 text-sm bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600"
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
          <h2 className="text-lg font-bold mb-2 uppercase tracking-tighter italic text-white border-b border-brand-cyan/30 pb-1 inline-block">Overview</h2>
          <p className="text-brand-silver leading-relaxed text-lg mb-4">
            {media.overview || 'No overview available.'}
          </p>
          
          {localProviders?.flatrate && localProviders.flatrate.length > 0 && (
            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
              {localProviders.flatrate.map((p) => (
                <ProviderIcon key={p.provider_id} provider={p} />
              ))}
            </div>
          )}
        </section>

        {media.media_type === 'tv' && media.seasons && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold uppercase tracking-tighter italic text-white border-b border-brand-cyan/30 pb-1 inline-block">Episodes</h2>
              <div className="relative">
                <select
                  value={selectedSeasonNumber}
                  onChange={(e) => setSelectedSeasonNumber(Number(e.target.value))}
                  className="appearance-none bg-brand-bg blueprint-border text-white font-bold py-2 pl-4 pr-10 rounded-lg outline-none focus:ring-1 focus:ring-brand-cyan cursor-pointer"
                >
                  {media.seasons.map((s) => (
                    <option key={s.id} value={s.season_number} className="bg-brand-bg">{s.name}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-silver pointer-events-none" />
              </div>
            </div>

            <div className="space-y-4">
              {seasonDetails ? seasonDetails.episodes.map((ep) => (
                <div key={ep.id} className="flex gap-3 p-3 sm:p-4 sm:gap-4 rounded-xl bg-brand-bg/50 blueprint-border">
                  <div className="w-24 sm:w-32 aspect-video rounded-lg overflow-hidden bg-brand-bg shrink-0 relative group blueprint-border">
                    {ep.still_path ? (
                      <img src={getImageUrl(ep.still_path)} alt={ep.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-brand-silver">
                        <Play size={24} />
                      </div>
                    )}
                    
                    {externalPlayerEnabled && selectedExternalPlayer && (
                      <a
                        href={getExternalPlayerUrl('tv', media.id, ep.season_number, ep.episode_number)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Play S${ep.season_number} E${ep.episode_number} on ${selectedExternalPlayer.name}`}
                        className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-brand-cyan/20 transition-colors"
                      >
                        <Play size={24} className="text-white/80 group-hover:text-brand-cyan fill-current" />
                      </a>
                    )}

                    <div className="absolute bottom-1 right-1 bg-brand-bg/80 text-white text-[8px] sm:text-[10px] font-bold px-1 rounded pointer-events-none blueprint-border">
                      S{ep.season_number} E{ep.episode_number}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 py-0.5 sm:py-1">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-0.5 sm:gap-4 mb-1">
                      <h3 className="font-bold text-white truncate text-sm sm:text-base" title={ep.name}>{ep.name}</h3>
                      <span className="text-[10px] sm:text-xs font-medium text-brand-silver whitespace-nowrap">
                        {ep.air_date ? new Date(ep.air_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'TBA'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-brand-silver line-clamp-2 leading-relaxed">
                      {ep.overview || 'No overview available.'}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="py-8 text-center text-brand-silver animate-pulse">Loading episodes...</div>
              )}
            </div>
          </section>
        )}

        {cast.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold mb-4 uppercase tracking-tighter italic text-white border-b border-brand-cyan/30 pb-1 inline-block">Top Cast</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {cast.map((actor) => (
                <button
                  key={actor.id}
                  onClick={() => handleActorClick(actor)}
                  className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-brand-bg/50 blueprint-border hover:bg-brand-bg transition-all group active:scale-95"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-brand-bg blueprint-border group-hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-shadow">
                    {actor.profile_path ? (
                      <img
                        src={getImageUrl(actor.profile_path, 'w185')}
                        alt={actor.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-brand-silver">
                        <UserIcon size={32} />
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-xs sm:text-sm font-bold text-white leading-tight mb-1">{actor.name}</p>
                    <p className="text-[10px] text-brand-silver font-medium uppercase tracking-tighter truncate max-w-[120px]">{actor.character}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {videos.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold mb-4 uppercase tracking-tighter italic text-white border-b border-brand-cyan/30 pb-1 inline-block">Trailers</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {videos.map((video) => (
                <div key={video.id} className="aspect-video rounded-xl overflow-hidden bg-black shadow-lg blueprint-border">
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

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onConfirm={modalConfig.onConfirm}
        confirmText={modalConfig.confirmText}
      />

      <CreditsModal
        isOpen={isCreditsModalOpen}
        onClose={() => setIsCreditsModalOpen(false)}
        actor={selectedActor}
        credits={actorCredits}
        loading={creditsLoading}
      />
    </div>
  );
}

const ProviderIcon = ({ provider }: { provider: WatchProvider }) => (
  <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm blueprint-border bg-brand-bg shrink-0">
    <img src={getImageUrl(provider.logo_path, 'w185')} alt={provider.provider_name} className="w-full h-full object-cover" />
  </div>
);