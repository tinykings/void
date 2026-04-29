'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { getImageUrl, getMediaCredits, getContentRating, getMediaDetails, getSeasonDetails, getWatchProviders } from '@/lib/tmdb';
import { checkVidAngelAvailability } from '@/lib/vidangel';
import { CastMember, Episode, Media, WatchProvider } from '@/lib/types';
import { Bookmark, Eye, Heart, Play, ShieldCheck, X } from 'lucide-react';
import { clsx } from 'clsx';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { SheetDragHandle } from '@/components/SheetDragHandle';

export const DetailsSheet = () => {
  const {
    activeDetailsMedia,
    closeDetails,
    apiKey,
    vidAngelEnabled,
    editedStatusMap,
    setMediaEditedStatus,
    watchlistIds,
    watchedIds,
    watchedMap,
    openDetails,
    openPoster,
    openActor,
    toggleWatchlist,
    toggleWatched,
    toggleFavorite,
    updateMediaMetadata,
  } = useAppContext();

  const [details, setDetails] = useState<Media | null>(null);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [watchProviders, setWatchProviders] = useState<WatchProvider[]>([]);
  const [contentRating, setContentRating] = useState<string | null>(null);
  const [headerEpisode, setHeaderEpisode] = useState<Episode | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [providersLoadedFor, setProvidersLoadedFor] = useState<number | null>(null);
  const [overviewLoadedFor, setOverviewLoadedFor] = useState<number | null>(null);
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
    confirmText: 'Confirm',
  });

  const selected = details || activeDetailsMedia;

  const mediaKey = useMemo(() => {
    if (!selected) return '';
    return `${selected.media_type}-${selected.id}`;
  }, [selected]);

  const inWatchlist = mediaKey ? watchlistIds.has(mediaKey) : false;
  const inWatched = mediaKey ? watchedIds.has(mediaKey) : false;
  const watchedItem = mediaKey ? watchedMap.get(mediaKey) : undefined;
  const isFavorite = watchedItem?.isFavorite || false;
  const isVidAngelAvailable = mediaKey ? editedStatusMap[mediaKey] : undefined;

  useEffect(() => {
    if (!selected || !vidAngelEnabled || isVidAngelAvailable !== undefined) return;

    let cancelled = false;

    checkVidAngelAvailability(selected.title || selected.name || '', selected.id)
      .then((slug) => {
        if (!cancelled) {
          setMediaEditedStatus(selected.id, selected.media_type, !!slug);
        }
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [isVidAngelAvailable, selected, setMediaEditedStatus, vidAngelEnabled]);

  useEffect(() => {
    if (!activeDetailsMedia) return;
    setDetails(activeDetailsMedia);
    setCast([]);
    setWatchProviders([]);
    setContentRating(null);
    setOverviewLoading(false);
    setProvidersLoadedFor(null);
    setOverviewLoadedFor(null);
  }, [activeDetailsMedia?.id, activeDetailsMedia?.media_type]);

  useEffect(() => {
    if (!activeDetailsMedia || !apiKey || providersLoadedFor === activeDetailsMedia.id) return;

    let cancelled = false;

    getWatchProviders(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey)
      .then((data) => {
        if (cancelled) return;

        const usProviders = data.results?.US;
        const providers = [...(usProviders?.free || []), ...(usProviders?.flatrate || [])]
          .filter((provider) => !provider.provider_name.includes('Amazon Channel'))
          .filter((provider, index, array) => array.findIndex((item) => item.provider_id === provider.provider_id) === index);

        setWatchProviders(providers);
        setProvidersLoadedFor(activeDetailsMedia.id);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [activeDetailsMedia, apiKey, providersLoadedFor]);

  useEffect(() => {
    if (!activeDetailsMedia || !apiKey || overviewLoadedFor === activeDetailsMedia.id) return;

    let cancelled = false;
    setOverviewLoading(true);

    Promise.all([
      getMediaDetails(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey),
      getMediaCredits(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey),
    ])
      .then(([mediaData, creditsData]) => {
        if (cancelled) return;
        setDetails(mediaData);
        setCast(creditsData.cast.slice(0, 4));
        setOverviewLoadedFor(activeDetailsMedia.id);
        updateMediaMetadata(mediaData.id, mediaData.media_type, {
          ...mediaData,
          lastChecked: Date.now(),
        });
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setOverviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeDetailsMedia, apiKey, overviewLoadedFor, updateMediaMetadata]);

  useEffect(() => {
    if (!activeDetailsMedia || !apiKey) return;

    let cancelled = false;

    getContentRating(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey)
      .then((rating) => {
        if (!cancelled) setContentRating(rating);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [activeDetailsMedia, apiKey]);

  useEffect(() => {
    const hasNextEpisode = !!selected?.next_episode_to_air;

    if (!selected || selected.media_type !== 'tv' || hasNextEpisode || !apiKey) {
      setHeaderEpisode(null);
      return;
    }

    const latestSeasonNumber = selected.seasons
      ?.filter((season) => season.season_number > 0)
      .reduce((latest, season) => Math.max(latest, season.season_number), 0);

    if (!latestSeasonNumber) {
      setHeaderEpisode(null);
      return;
    }

    let cancelled = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    getSeasonDetails(selected.id, latestSeasonNumber, apiKey)
      .then((season) => {
        if (cancelled) return;

        const lastAiredEpisode = [...season.episodes]
          .filter((episode) => episode.air_date && new Date(episode.air_date).getTime() <= todayTime)
          .sort((a, b) => {
            const dateDiff = new Date(b.air_date).getTime() - new Date(a.air_date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return b.episode_number - a.episode_number;
          })[0] || null;

        setHeaderEpisode(lastAiredEpisode);
      })
      .catch(() => {
        if (!cancelled) setHeaderEpisode(null);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, selected]);

  useEffect(() => {
    if (!activeDetailsMedia) return;
    if ('overflow' in document.body.style) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [activeDetailsMedia]);

  const isOpen = !!activeDetailsMedia && !!selected;

  if (!isOpen || !selected) return null;

  const title = selected.title || selected.name || 'Unknown';
  const nextEpisode = selected.media_type === 'tv' ? selected.next_episode_to_air : null;
  const episodeLabel = nextEpisode
    ? `Next • S${nextEpisode.season_number}E${nextEpisode.episode_number} • ${nextEpisode.name}`
    : headerEpisode
      ? `Last • S${headerEpisode.season_number}E${headerEpisode.episode_number} • ${headerEpisode.name}`
    : null;
  const movieReleaseLabel = (() => {
    if (selected.media_type !== 'movie' || !selected.release_date) return null;

    const releaseDate = new Date(selected.release_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (releaseDate.getTime() <= today.getTime()) return null;

    return `Release • ${new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(releaseDate)}`;
  })();
  const justWatchSearchUrl = `https://www.justwatch.com/us/search?q=${encodeURIComponent(title)}`;
  const year = (selected.release_date || selected.first_air_date || '').split('-')[0];
  const trailerSearchUrl = (() => {
    const parts = [title];
    if (year) parts.push(year);
    parts.push('trailer');
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(parts.join(' '))}`;
  })();
  const compactActions = inWatched;
  const handleWatchlistToggle = () => {
    if (inWatchlist) {
      setModalConfig({
        isOpen: true,
        title: 'Remove from Watchlist',
        message: `Remove \"${title}\" from your watchlist?`,
        type: 'danger',
        confirmText: 'Remove',
        onConfirm: async () => {
          await toggleWatchlist(selected);
          openDetails(selected);
        },
      });
      return;
    }

    toggleWatchlist(selected);
  };

  const handleWatchedToggle = () => {
    if (inWatched) {
      setModalConfig({
        isOpen: true,
        title: 'Remove from Watched',
        message: `Remove \"${title}\" from watched?`,
        type: 'danger',
        confirmText: 'Remove',
        onConfirm: async () => {
          await toggleWatched(selected);
          openDetails(selected);
        },
      });
      return;
    }

    toggleWatched(selected);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[350] flex items-end justify-center" onClick={closeDetails}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl h-[86vh] sm:h-[80vh] lg:h-[74vh] max-h-[92vh] bg-brand-bg/95 blueprint-border rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-brand-bg/80">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 pr-2">
                    <h2 className="min-w-0 text-lg font-black text-white uppercase tracking-tight leading-tight">{title}</h2>
                    {(episodeLabel || movieReleaseLabel) && (
                      <span className="inline-flex max-w-full items-center rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-2.5 py-1 text-[10px] font-semibold text-brand-cyan">
                        {episodeLabel || movieReleaseLabel}
                      </span>
                    )}
                    {vidAngelEnabled && isVidAngelAvailable && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300/70 bg-amber-500/85 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-brand-bg">
                        <ShieldCheck size={10} />
                        Edited
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={closeDetails}
                  className="p-2 text-brand-silver hover:text-white transition-colors bg-white/5 rounded-full"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-24">
                <div className="pt-4 grid grid-cols-[88px_1fr] gap-4 items-start">
                  <button
                    type="button"
                    onClick={() => selected.poster_path && openPoster(selected)}
                    disabled={!selected.poster_path}
                    className={clsx(
                      'aspect-[2/3] rounded-xl overflow-hidden blueprint-border bg-brand-bg/50 text-left',
                      selected.poster_path ? 'cursor-zoom-in' : 'cursor-default'
                    )}
                  >
                    {selected.poster_path ? (
                      <img src={getImageUrl(selected.poster_path, 'w342')} alt={title} className="w-full h-full object-cover" decoding="async" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-brand-silver text-xs text-center p-2">No poster</div>
                    )}
                  </button>

                  <div className="space-y-3">
                    <p className="text-sm text-brand-silver leading-relaxed line-clamp-4">
                      {selected.overview || 'No overview available.'}
                    </p>

                    <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-widest font-bold text-brand-silver">
                      <span className="px-2 py-1 rounded-full bg-white/5">{selected.media_type}</span>
                      {year && <span className="px-2 py-1 rounded-full bg-white/5">{year}</span>}
                      <span className="px-2 py-1 rounded-full bg-white/5">★ {selected.vote_average?.toFixed(1) || '0.0'}</span>
                      <span className="px-2 py-1 rounded-full bg-white/5">{contentRating || 'N/A'}</span>
                    </div>

                  </div>
                </div>

                <div className={`mt-4 grid gap-2 ${inWatched ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <button
                    onClick={handleWatchlistToggle}
                    title={inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                    aria-label={inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                    className={clsx(
                      'w-full flex items-center justify-center rounded-xl px-3 py-3 transition-colors blueprint-border',
                      compactActions ? 'gap-2' : 'gap-2 min-[1000px]:gap-2',
                      inWatchlist ? 'bg-brand-cyan/15 text-brand-cyan' : 'bg-white/5 text-white hover:bg-white/10'
                    )}
                  >
                    <Bookmark size={14} className="hidden min-[1000px]:inline" />
                    <span className={compactActions ? 'hidden min-[1000px]:inline text-xs font-black uppercase tracking-widest' : 'text-xs font-black uppercase tracking-widest'}>Watchlist</span>
                    <span className={compactActions ? 'text-xs font-black uppercase tracking-widest min-[1000px]:hidden' : 'hidden'}>List</span>
                  </button>
                  <button
                    onClick={handleWatchedToggle}
                    title={inWatched ? 'Watched' : 'Mark Watched'}
                    aria-label={inWatched ? 'Watched' : 'Mark Watched'}
                    className={clsx(
                      'w-full flex items-center justify-center rounded-xl px-3 py-3 transition-colors blueprint-border',
                      compactActions ? 'gap-2' : 'gap-2 min-[1000px]:gap-2',
                      inWatched ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white hover:bg-white/10'
                    )}
                  >
                    <Eye size={14} className="hidden min-[1000px]:inline" />
                    <span className={compactActions ? 'hidden min-[1000px]:inline text-xs font-black uppercase tracking-widest' : 'text-xs font-black uppercase tracking-widest'}>Watched</span>
                    <span className={compactActions ? 'text-xs font-black uppercase tracking-widest min-[1000px]:hidden' : 'hidden'}>Watched</span>
                  </button>
                  {inWatched && (
                    <button
                      onClick={() => toggleFavorite(selected)}
                      title={isFavorite ? 'Favorited' : 'Favorite'}
                      aria-label={isFavorite ? 'Favorited' : 'Favorite'}
                      className={clsx(
                        'w-full flex items-center justify-center rounded-xl px-3 py-3 transition-colors blueprint-border',
                        compactActions ? 'gap-2' : 'gap-2 min-[1000px]:gap-2',
                        isFavorite ? 'bg-red-500/15 text-red-300' : 'bg-white/5 text-white hover:bg-white/10'
                      )}
                    >
                      <Heart size={14} className={isFavorite ? 'fill-current hidden min-[1000px]:inline' : 'hidden min-[1000px]:inline'} />
                      <span className="hidden min-[1000px]:inline text-xs font-black uppercase tracking-widest">Favorite</span>
                      <span className="text-xs font-black uppercase tracking-widest min-[1000px]:hidden">Fav</span>
                    </button>
                  )}
                </div>

                <div className="mt-4 space-y-5">
                  <a
                    href={justWatchSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl bg-white/5 blueprint-border p-3 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="mt-1 text-sm text-white truncate">
                          {watchProviders.length > 0
                            ? watchProviders.map((provider) => provider.provider_name).join(' · ')
                            : 'View streaming options on JustWatch'}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-widest text-brand-silver">
                          data provided by JustWatch
                        </p>
                      </div>
                      <Play className="text-brand-cyan shrink-0" size={16} />
                    </div>
                  </a>

                  <div>
                    <div className="grid grid-cols-2 gap-2">
                      {overviewLoading && cast.length === 0 ? (
                        [...Array(4)].map((_, index) => (
                          <div key={index} className="flex items-center gap-3 p-2 rounded-xl bg-white/5 blueprint-border">
                            <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
                              <div className="h-2 w-16 rounded bg-white/10 animate-pulse" />
                            </div>
                          </div>
                        ))
                      ) : cast.length > 0 ? (
                        cast.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => openActor(member)}
                          className="flex items-center gap-3 p-2 rounded-xl bg-white/5 blueprint-border hover:bg-white/10 transition-colors text-left"
                        >
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-bg shrink-0">
                            {member.profile_path ? (
                              <img src={getImageUrl(member.profile_path, 'w185')} alt={member.name} className="w-full h-full object-cover" decoding="async" />
                            ) : null}
                          </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{member.name}</p>
                              <p className="text-[10px] text-brand-silver truncate">{member.character}</p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-brand-silver">Cast will load when available.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <a
                      href={trailerSearchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 blueprint-border hover:bg-white/10 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">
                          <span className="text-white">Trailers</span>{' '}
                          <span className="text-brand-silver/70">(YouTube)</span>
                        </p>
                      </div>
                      <Play className="text-brand-cyan shrink-0" size={16} />
                    </a>

                    <p className="mt-2 text-center text-[10px] uppercase tracking-[0.2em] text-brand-silver/60">
                      Data provided by TMDB.
                    </p>
                  </div>
                </div>
              </div>

              <SheetDragHandle onClose={closeDetails} />
            </motion.div>

            <ConfirmationModal
              isOpen={modalConfig.isOpen}
              title={modalConfig.title}
              message={modalConfig.message}
              type={modalConfig.type}
              onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
              onConfirm={modalConfig.onConfirm}
              confirmText={modalConfig.confirmText}
            />
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
