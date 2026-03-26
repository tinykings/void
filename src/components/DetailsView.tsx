'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { getMediaDetails, getWatchProviders, getImageUrl, getContentRating, getSeasonDetails, getMediaVideos, getMediaCredits, getPersonCredits, getUSReleaseDate } from '@/lib/tmdb';
import { checkVidAngelAvailability } from '@/lib/vidangel';
import { Media, WatchProvidersResponse, WatchProvider, SeasonDetails, Video, SeasonSummary, CastMember } from '@/lib/types';
import { ChevronLeft, Check, Play, Star, Calendar, ChevronDown, User as UserIcon, Bookmark, Eye, Heart, Trash2, X } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { CreditsModal } from '@/components/CreditsModal';
import { StreamPickerModal } from '@/components/PlayTargetModal';

export default function DetailsView() {
  const searchParams = useSearchParams();
  const type = searchParams.get('type') as 'movie' | 'tv';
  const id = searchParams.get('id');
  const router = useRouter();
  const {
    apiKey,
    watchlistIds,
    watchedIds,
    watchedMap,
    toggleWatchlist,
    toggleWatched,
    toggleFavorite,
    vidAngelEnabled,
    externalPlayerEnabled,
    playedEpisodes,
    markEpisodePlayed,
    updateMediaMetadata,
  } = useAppContext();

  const [media, setMedia] = useState<Media | null>(null);
  const [rating, setRating] = useState<string | null>(null);
  const [usReleaseDate, setUsReleaseDate] = useState<string | null>(null);
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

  // Stream picker state
  const [streamPicker, setStreamPicker] = useState<{ open: boolean; seasonNum?: number; episodeNum?: number }>({ open: false });

  // Fullscreen poster state
  const [isFullscreenPosterOpen, setIsFullscreenPosterOpen] = useState(false);

  // Watchlist dropdown state
  const [showWatchlistMenu, setShowWatchlistMenu] = useState(false);

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
        getMediaCredits(parseInt(id), type, apiKey),
        getUSReleaseDate(parseInt(id), type, apiKey)
      ])
        .then(async ([mediaData, providerData, ratingData, videoData, creditsData, usDate]) => {
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
          setUsReleaseDate(usDate);
          setCast(creditsData.cast.slice(0, 3));
          
          // Update global store metadata so things like next_episode_to_air are persisted
          updateMediaMetadata(mediaData.id, mediaData.media_type, {
            ...mediaData,
            lastChecked: Date.now()
          });
          
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

  const mediaKey = `${media.media_type}-${media.id}`;
  const inWatchlist = watchlistIds.has(mediaKey);
  const inWatched = watchedIds.has(mediaKey);
  const watchedItem = watchedMap.get(mediaKey);
  const isFavorite = watchedItem?.isFavorite || false;
  const vidAngelAvailable = !!vidAngelSlug;

  const title = media.title || media.name;
  const displayDate = media.media_type === 'movie' ? usReleaseDate : (media.first_air_date || usReleaseDate);
  const year = displayDate?.split('-')[0];
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
        }
      });
    } else {
      toggleWatchlist(media);
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
        }
      });
    } else {
      toggleWatched(media);
    }
  };

  const handleEpisodeSelect = () => {
    if (streamPicker.seasonNum !== undefined && streamPicker.episodeNum !== undefined) {
      markEpisodePlayed(media.id, streamPicker.seasonNum, streamPicker.episodeNum);
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

  return (
    <>
      <button
        onClick={() => router.push('/')}
        className="fixed left-4 z-50 p-2 rounded-full bg-black/50 text-white/80 hover:text-white transition-all active:scale-95"
        style={{ top: 'max(16px, env(safe-area-inset-top))' }}
      >
        <ChevronLeft size={24} />
      </button>

      <div className="pb-20" style={{ paddingTop: 'max(64px, calc(env(safe-area-inset-top) + 16px))' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col items-center gap-6 md:gap-10">
            {media.poster_path && (
              <button 
                onClick={() => setIsFullscreenPosterOpen(true)}
                className="relative group transition-all active:scale-95 cursor-zoom-in"
              >
                <img
                  src={getImageUrl(media.poster_path, 'w500')}
                  alt=""
                  className="w-32 sm:w-40 md:w-48 lg:w-[200px] rounded-2xl shadow-2xl shadow-brand-cyan/20 blueprint-border shrink-0"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-brand-cyan/0 group-hover:bg-brand-cyan/10 rounded-2xl transition-colors" />
              </button>
            )}
            <div className="flex-1 min-w-0 text-center">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-4 text-white drop-shadow-[0_0_15px_rgba(34,211,238,0.2)] uppercase italic tracking-tighter">{title}</h1>
              <div className="flex flex-wrap items-center justify-center gap-3 text-xs md:text-sm font-bold text-brand-silver uppercase tracking-wider mb-6">
              <span className="flex items-center gap-1"><Calendar size={14} /> {displayDate || year}</span>
              <span className="flex items-center gap-1"><Star size={14} className="text-brand-cyan fill-brand-cyan" /> {media.vote_average.toFixed(1)}</span>
              {media.media_type === 'tv' && media.status && (
                <span className="bg-brand-bg/50 blueprint-border px-2 py-0.5 rounded">{media.status}</span>
              )}
              {rating && (
                <span className="bg-brand-bg/50 blueprint-border px-2 py-0.5 rounded border border-white/5">{rating}</span>
              )}
            </div>

            {media.next_episode_to_air && (
                <div className="mt-4 px-4 py-2 bg-brand-cyan/10 blueprint-border rounded-xl inline-block mx-auto">
                  <p className="text-xs md:text-sm font-bold text-brand-cyan">
                    NEXT EPISODE: {new Date(media.next_episode_to_air.air_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    <span className="ml-2 opacity-75 font-medium">(S{media.next_episode_to_air.season_number} E{media.next_episode_to_air.episode_number})</span>
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3 mt-6">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setShowWatchlistMenu(!showWatchlistMenu)}
                      className={clsx(
                        "py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 text-sm",
                        inWatchlist || inWatched
                          ? "bg-brand-cyan/20 blueprint-border text-brand-cyan"
                          : "bg-brand-bg/50 blueprint-border text-brand-silver hover:bg-brand-bg hover:text-white"
                      )}
                    >
                      <Bookmark size={16} className={(inWatchlist || inWatched) ? 'fill-current' : ''} />
                      <span>{inWatched ? 'Watched' : 'Watchlist'}</span>
                    </button>
                    
                    {showWatchlistMenu && (
                      <div className="absolute top-full left-0 right-0 mt-2 py-2 rounded-xl bg-brand-bg blueprint-border shadow-xl z-20 min-w-[140px]">
                        <button
                          onClick={() => {
                            handleWatchlistToggle();
                            setShowWatchlistMenu(false);
                          }}
                          className={clsx(
                            "w-full px-4 py-2 text-left text-sm font-bold flex items-center gap-2 transition-colors",
                            inWatchlist
                              ? "text-brand-cyan bg-brand-cyan/5"
                              : "text-brand-silver hover:text-white hover:bg-brand-bg/50"
                          )}
                        >
                          <Bookmark size={16} className={inWatchlist ? 'fill-current' : ''} />
                          Watchlist
                        </button>
                        <button
                          onClick={() => {
                            handleWatchedToggle();
                            setShowWatchlistMenu(false);
                          }}
                          className={clsx(
                            "w-full px-4 py-2 text-left text-sm font-bold flex items-center gap-2 transition-colors",
                            inWatched
                              ? "text-green-400 bg-green-400/5"
                              : "text-brand-silver hover:text-white hover:bg-brand-bg/50"
                          )}
                        >
                          {inWatched ? <Check size={16} className="fill-current" /> : <Eye size={16} />}
                          Watched
                        </button>

                        {(inWatchlist || inWatched) && (
                          <>
                            <div className="h-px bg-white/5 my-1" />
                            <button
                              onClick={() => {
                                if (inWatchlist) handleWatchlistToggle();
                                else if (inWatched) handleWatchedToggle();
                                setShowWatchlistMenu(false);
                              }}
                              className="w-full px-4 py-2 text-left text-sm font-bold flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={16} />
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {inWatched && (
                      <button
                        onClick={() => toggleFavorite(media)}
                        className={clsx(
                          "py-2 px-3 rounded-xl flex items-center justify-center font-bold transition-all active:scale-95 text-sm",
                          isFavorite
                            ? "bg-red-500/20 blueprint-border text-red-400"
                            : "bg-brand-bg/50 blueprint-border text-brand-silver hover:bg-brand-bg hover:text-red-400"
                        )}
                        title={isFavorite ? "Remove from favorites" : "Mark as favorite"}
                      >
                        <Heart size={16} className={isFavorite ? 'fill-current' : ''} />
                      </button>
                    )}

                    {(externalPlayerEnabled || vidAngelAvailable) && (
                      <button
                        onClick={() => setStreamPicker({ open: true })}
                        className="py-2 px-3 rounded-xl flex items-center justify-center font-bold transition-all active:scale-95 text-sm bg-green-500 text-brand-bg shadow-lg shadow-green-500/20 hover:bg-green-500/90"
                      >
                        <Play size={16} className="fill-brand-bg" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section className="mt-8 flex flex-col items-center text-center">
            <h2 className="text-lg font-bold mb-2 uppercase tracking-tighter italic text-white border-b border-brand-cyan/30 pb-1 inline-block">Overview</h2>
            <p className="text-brand-silver leading-relaxed text-lg mb-4 max-w-2xl">
              {media.overview || 'No overview available.'}
            </p>
            
            {localProviders?.flatrate && localProviders.flatrate.length > 0 && (
              <div className="flex flex-wrap gap-3 justify-center">
                {localProviders.flatrate.map((p) => (
                  <ProviderIcon key={p.provider_id} provider={p} />
                ))}
              </div>
            )}
          </section>

          {media.media_type === 'tv' && media.seasons && (
            <section className="mt-8 flex flex-col items-center w-full">
              <div className="flex flex-col items-center gap-4 mb-6">
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

              <div className="space-y-4 w-full max-w-2xl">
                {seasonDetails ? seasonDetails.episodes.map((ep) => (
                  <div key={ep.id} className="flex gap-3 p-3 sm:p-4 sm:gap-4 rounded-xl bg-brand-bg/50 blueprint-border">
                    <div className="w-24 sm:w-32 aspect-video rounded-lg overflow-hidden bg-brand-bg shrink-0 relative group blueprint-border">
                      {ep.still_path ? (
                        <img src={getImageUrl(ep.still_path)} alt={ep.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-brand-silver">
                          <Play size={24} />
                        </div>
                      )}
                      
                      {externalPlayerEnabled && (
                        <button
                          onClick={() => setStreamPicker({ open: true, seasonNum: ep.season_number, episodeNum: ep.episode_number })}
                          title={`Stream S${ep.season_number} E${ep.episode_number}`}
                          className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-brand-cyan/20 transition-colors"
                        >
                          <Play size={24} className="text-white/80 group-hover:text-brand-cyan fill-current" />
                        </button>
                      )}

                      <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between pointer-events-none">
                        {playedEpisodes[`${media.id}-${ep.season_number}-${ep.episode_number}`] && (
                          <span className="text-brand-cyan text-[16px] sm:text-[20px] font-bold">✓</span>
                        )}
                        <span className="bg-brand-bg/80 text-white text-[8px] sm:text-[10px] font-bold px-1 rounded blueprint-border ml-auto">
                          S{ep.season_number} E{ep.episode_number}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 py-0.5 sm:py-1 text-left">
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
            <section className="mt-8 flex flex-col items-center w-full">
              <h2 className="text-lg font-bold mb-4 uppercase tracking-tighter italic text-white border-b border-brand-cyan/30 pb-1 inline-block text-center">Cast</h2>
              <div className="flex flex-wrap justify-center gap-3 w-full max-w-3xl">
                {cast.map((actor) => (
                  <button
                    key={actor.id}
                    onClick={() => handleActorClick(actor)}
                    className="relative w-[calc(33.333%-12px)] sm:w-[calc(16.666%-12px)] aspect-[3/4] rounded-xl overflow-hidden bg-brand-bg/50 blueprint-border hover:bg-brand-bg transition-all group active:scale-95"
                  >
                    {actor.profile_path ? (
                      <img
                        src={getImageUrl(actor.profile_path, 'w185')}
                        alt={actor.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-brand-silver bg-brand-bg">
                        <UserIcon size={24} className="mb-1 opacity-20" />
                      </div>
                    )}
                    
                    {/* Bottom Info Box Overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-6">
                      <p className="text-[10px] sm:text-xs font-black text-white leading-tight mb-0.5 uppercase italic tracking-tighter truncate">{actor.name}</p>
                      <p className="text-[8px] text-brand-cyan font-bold uppercase tracking-widest truncate opacity-80">{actor.character}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {videos.length > 0 && (
            <section className="mt-8 flex flex-col items-center w-full">
              <h2 className="text-lg font-bold mb-4 uppercase tracking-tighter italic text-white border-b border-brand-cyan/30 pb-1 inline-block text-center">Trailers</h2>
              <div className="flex flex-wrap justify-center gap-4 w-full max-w-5xl">
                {videos.map((video) => (
                  <div key={video.id} className="aspect-video rounded-xl overflow-hidden bg-black shadow-lg blueprint-border w-full md:w-[calc(50%-8px)]">
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

      <StreamPickerModal
        isOpen={streamPicker.open}
        onClose={() => setStreamPicker({ open: false })}
        title={
          streamPicker.seasonNum !== undefined
            ? `${media.name || media.title} S${streamPicker.seasonNum} E${streamPicker.episodeNum}`
            : media.title || media.name || 'Unknown'
        }
        mediaTitle={media.title || media.name || 'Unknown'}
        mediaType={media.media_type}
        mediaId={media.id}
        seasonNum={streamPicker.seasonNum}
        episodeNum={streamPicker.episodeNum}
        vidAngelSlug={streamPicker.seasonNum === undefined ? vidAngelSlug : null}
        externalPlayerEnabled={externalPlayerEnabled}
        onSelect={handleEpisodeSelect}
      />

      {/* Fullscreen Poster Modal */}
      {isFullscreenPosterOpen && media.poster_path && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setIsFullscreenPosterOpen(false)}
        >
          <button
            onClick={() => setIsFullscreenPosterOpen(false)}
            className="fixed top-6 right-6 z-[110] p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all active:scale-90"
          >
            <X size={28} />
          </button>
          
          <div className="relative max-w-full max-h-[90vh] aspect-[2/3] animate-in zoom-in-95 duration-300">
            <img
              src={getImageUrl(media.poster_path, 'original')}
              alt={title}
              className="w-full h-full object-contain rounded-xl shadow-[0_0_50px_rgba(34,211,238,0.2)] blueprint-border"
              decoding="async"
            />
          </div>
        </div>
      )}
    </>
  );
}

const ProviderIcon = ({ provider }: { provider: WatchProvider }) => (
  <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm blueprint-border bg-brand-bg shrink-0">
    <img src={getImageUrl(provider.logo_path, 'w185')} alt={provider.provider_name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
  </div>
);
