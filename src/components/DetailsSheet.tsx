'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { getImageUrl, getMediaCredits, getContentRating, getExternalIds, getMediaDetails, getMediaImages, getMediaVideos, getSeasonDetails, getUSStreamingProviders, getWatchProviders } from '@/lib/tmdb';
import { CastMember, Episode, ExternalIdsResponse, Media, TmdbImage, Video, WatchProvider } from '@/lib/types';
import { Bookmark, ChevronDown, Eye, Film, Image as ImageIcon, Info, Play, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { FocusTrap } from '@/components/FocusTrap';

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const } },
};

type InfoSection = 'overview' | 'cast' | 'images' | 'trailers';

export const DetailsSheet = () => {
  const {
    activeDetailsMedia,
    closeDetails,
    apiKey,
    watchlistIds,
    watchedIds,
    openActor,
    closeAllSheets,
    toggleWatchlist,
    toggleWatched,
    updateMediaMetadata,
  } = useAppContext();

  const [details, setDetails] = useState<{ id: number; media: Media } | null>(null);
  const [cast, setCast] = useState<{ id: number; items: CastMember[] } | null>(null);
  const [backdrops, setBackdrops] = useState<{ id: number; items: TmdbImage[] } | null>(null);
  const [trailers, setTrailers] = useState<{ id: number; items: Video[] } | null>(null);
  const [watchProviders, setWatchProviders] = useState<{ id: number; items: WatchProvider[] } | null>(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState<{ id: number; items: Episode[] } | null>(null);
  const [contentRating, setContentRating] = useState<{ id: number; value: string | null } | null>(null);
  const [externalIds, setExternalIds] = useState<{ id: number; value: ExternalIdsResponse | null } | null>(null);
  const [overviewLoadedFor, setOverviewLoadedFor] = useState<number | null>(null);
  const [activeInfoSection, setActiveInfoSection] = useState<{ id: number; section: InfoSection } | null>(null);
  const [loadingInfoSection, setLoadingInfoSection] = useState<{ id: number; section: InfoSection } | null>(null);
  const [activeTrailer, setActiveTrailer] = useState<{ mediaId: number; videoId: string } | null>(null);
  const [actionPulse, setActionPulse] = useState<{ id: number; action: 'watchlist' | 'watched' } | null>(null);
  const closeActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const [initError, setInitError] = useState(false);
  const [sectionErrors, setSectionErrors] = useState<Set<string>>(new Set());
  const [retryCount, setRetryCount] = useState(0);

  const handleRetryInit = () => {
    setInitError(false);
    setRetryCount(c => c + 1);
  };

  const handleRetrySection = (section: string) => {
    setSectionErrors(prev => {
      const next = new Set(prev);
      next.delete(section);
      return next;
    });
    setRetryCount(c => c + 1);
  };

  const selected = activeDetailsMedia && details?.id === activeDetailsMedia.id ? details.media : activeDetailsMedia;
  const mediaKey = useMemo(() => {
    if (!selected) return '';
    return `${selected.media_type}-${selected.id}`;
  }, [selected]);

  const inWatchlist = mediaKey ? watchlistIds.has(mediaKey) : false;
  const inWatched = mediaKey ? watchedIds.has(mediaKey) : false;
  const castItems = selected && cast?.id === selected.id ? cast.items : [];
  const backdropItems = selected && backdrops?.id === selected.id ? backdrops.items : [];
  const trailerItems = selected && trailers?.id === selected.id ? trailers.items : [];
  const watchProviderItems = selected && watchProviders?.id === selected.id ? watchProviders.items : [];
  const seasonEpisodeItems = selected && seasonEpisodes?.id === selected.id ? seasonEpisodes.items : [];
  const contentRatingValue = selected && contentRating?.id === selected.id ? contentRating.value : null;
  const externalIdsValue = selected && externalIds?.id === selected.id ? externalIds.value : null;
  const imdbUrl = externalIdsValue?.imdb_id ? `https://www.imdb.com/title/${externalIdsValue.imdb_id}` : '';
  const commonSenseUrl = selected ? `https://www.commonsensemedia.org/search/${encodeURIComponent(selected.title || selected.name || '')}` : '';
  const backdropPath = selected?.backdrop_path;
  const currentActionPulse = selected && actionPulse?.id === selected.id ? actionPulse.action : null;
  const currentInfoSection = selected && activeInfoSection?.id === selected.id ? activeInfoSection.section : null;
  const currentLoadingInfoSection = selected && loadingInfoSection?.id === selected.id ? loadingInfoSection.section : null;
  const currentActiveTrailerId = selected && activeTrailer?.mediaId === selected.id ? activeTrailer.videoId : null;

  useEffect(() => {
    if (!activeDetailsMedia || !apiKey || overviewLoadedFor === activeDetailsMedia.id) return;

    let cancelled = false;

    getMediaDetails(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey)
      .then((mediaData) => {
        if (cancelled) return;
        setDetails({ id: mediaData.id, media: mediaData });
        setOverviewLoadedFor(activeDetailsMedia.id);
        updateMediaMetadata(mediaData.id, mediaData.media_type, {
          ...mediaData,
          lastChecked: Date.now(),
        });
      })
      .catch(() => {
        if (!cancelled) setInitError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [activeDetailsMedia, apiKey, overviewLoadedFor, updateMediaMetadata, retryCount]);

  useEffect(() => {
    return () => {
      if (closeActionTimerRef.current) clearTimeout(closeActionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activeDetailsMedia) {
      queueMicrotask(() => {
        setActiveInfoSection(null);
        setLoadingInfoSection(null);
        setActiveTrailer(null);
      });
      return;
    }

    if (!activeInfoSection || activeInfoSection.id !== activeDetailsMedia.id) {
      queueMicrotask(() => {
        setActiveInfoSection({ id: activeDetailsMedia.id, section: 'overview' });
      });
    }
  }, [activeDetailsMedia]);

  useEffect(() => {
    const section = activeInfoSection && activeDetailsMedia && activeInfoSection.id === activeDetailsMedia.id ? activeInfoSection.section : null;
    if (!activeDetailsMedia || !apiKey || !section) return;

    const mediaForSection = details?.id === activeDetailsMedia.id && details?.media ? details.media : activeDetailsMedia;
    if (section === 'overview' && watchProviders?.id === activeDetailsMedia.id && (mediaForSection.media_type !== 'tv' || seasonEpisodes?.id === activeDetailsMedia.id)) return;
    if (section === 'cast' && cast?.id === activeDetailsMedia.id) return;
    if (section === 'images' && backdrops?.id === activeDetailsMedia.id) return;
    if (section === 'trailers' && trailers?.id === activeDetailsMedia.id) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoadingInfoSection({ id: activeDetailsMedia.id, section });
    });

    const request = section === 'overview'
      ? (async () => {
          const data = await getWatchProviders(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey);
          if (cancelled) return;
          setWatchProviders({ id: activeDetailsMedia.id, items: getUSStreamingProviders(data) });

          if (mediaForSection.media_type === 'tv' && !cancelled && seasonEpisodes?.id !== activeDetailsMedia.id) {
            const seasons = mediaForSection.seasons?.filter((s) => s.season_number > 0) || [];
            const episodePromises = seasons.map((season) =>
              getSeasonDetails(activeDetailsMedia.id, season.season_number, apiKey)
                .then((seasonData) => seasonData.episodes)
                .catch(() => [] as Episode[])
            );
            const episodeResults = await Promise.all(episodePromises);
            const allEpisodes = episodeResults.flat().sort((a, b) => {
              if (a.season_number !== b.season_number) return a.season_number - b.season_number;
              return a.episode_number - b.episode_number;
            });
            if (!cancelled) setSeasonEpisodes({ id: activeDetailsMedia.id, items: allEpisodes });
          }
        })()
      : section === 'cast'
      ? getMediaCredits(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey).then((data) => {
          if (!cancelled) setCast({ id: activeDetailsMedia.id, items: data.cast });
        })
      : section === 'images'
        ? getMediaImages(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey).then((data) => {
            const selectedBackdrops = [...(data.backdrops || [])]
              .sort((a, b) => {
                const voteCountDiff = b.vote_count - a.vote_count;
                if (voteCountDiff !== 0) return voteCountDiff;
                return b.vote_average - a.vote_average;
              })
              .slice(0, 25);

            if (!cancelled) setBackdrops({ id: activeDetailsMedia.id, items: selectedBackdrops });
          })
        : getMediaVideos(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey).then((data) => {
            const selectedTrailers = [...(data.results || [])]
              .filter((video) => video.site === 'YouTube' && video.type === 'Trailer')
              .sort((a, b) => {
                if (a.official !== b.official) return a.official ? -1 : 1;
                return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
              });

            if (!cancelled) setTrailers({ id: activeDetailsMedia.id, items: selectedTrailers });
          });

    request
      .catch(() => {
        if (!cancelled && section) setSectionErrors(prev => new Set(prev).add(section));
      })
      .finally(() => {
        if (!cancelled) setLoadingInfoSection(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeDetailsMedia, activeInfoSection, apiKey, backdrops?.id, cast?.id, trailers?.id, watchProviders?.id, seasonEpisodes?.id, retryCount]);

  useEffect(() => {
    if (!activeDetailsMedia || !apiKey) return;

    let cancelled = false;

    getContentRating(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey)
      .then((rating) => {
        if (!cancelled) setContentRating({ id: activeDetailsMedia.id, value: rating });
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [activeDetailsMedia, apiKey]);

  useEffect(() => {
    if (!activeDetailsMedia || !apiKey) return;

    let cancelled = false;

    getExternalIds(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey)
      .then((ids) => {
        if (!cancelled) setExternalIds({ id: activeDetailsMedia.id, value: ids });
      })
      .catch(() => {
        if (!cancelled) setExternalIds({ id: activeDetailsMedia.id, value: null });
      });

    return () => {
      cancelled = true;
    };
  }, [activeDetailsMedia, apiKey]);

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
  const year = (selected.release_date || selected.first_air_date || '').split('-')[0];
  const runActionAndClose = async (action: 'watchlist' | 'watched', commit: () => Promise<void> | void) => {
    if (closeActionTimerRef.current) clearTimeout(closeActionTimerRef.current);

    setActionPulse({ id: selected.id, action });
    await Promise.resolve(commit());

    closeActionTimerRef.current = setTimeout(() => {
      closeDetails();
      setActionPulse(null);
    }, 250);
  };

  const handleWatchlistToggle = () => {
    if (inWatchlist) {
      setModalConfig({
        isOpen: true,
        title: 'Remove from Watchlist',
        message: `Remove \"${title}\" from your watchlist?`,
        type: 'danger',
        confirmText: 'Remove',
        onConfirm: async () => {
          await runActionAndClose('watchlist', () => toggleWatchlist(selected));
        },
      });
      return;
    }

    void runActionAndClose('watchlist', () => toggleWatchlist(selected));

    toast(`${title} → watchlist`, {
      action: {
        label: 'Undo',
        onClick: () => toggleWatchlist(selected),
      },
      duration: 4000,
    });
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
          await runActionAndClose('watched', () => toggleWatched(selected));
        },
      });
      return;
    }

    void runActionAndClose('watched', () => toggleWatched(selected));

    toast(`${title} → watched`, {
      action: {
        label: 'Undo',
        onClick: () => toggleWatched(selected),
      },
      duration: 4000,
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[350] flex items-end justify-center" onClick={closeAllSheets}>
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
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl h-[92vh] max-h-[96vh] bg-brand-bg/95 embossed-edge rounded-t-3xl overflow-hidden flex flex-col will-change-transform"
            >
              <FocusTrap active={isOpen}>
              {backdropPath && (
                <div className="absolute inset-0 pointer-events-none">
                  <img
                    src={getImageUrl(backdropPath, 'w780')}
                    alt=""
                    className="h-full w-full object-cover"
                    decoding="async"
                    loading="lazy"
                    sizes="100vw"
                    aria-hidden="true"
                  />
                </div>
              )}

              <div className="absolute inset-x-0 top-[14vh] bottom-0 pointer-events-none bg-gradient-to-b from-transparent via-brand-bg/80 via-45% to-brand-bg" />
              <AnimatePresence>
                {currentInfoSection && (
                  <motion.div
                    key="overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 pointer-events-none bg-brand-bg/55"
                  />
                )}
              </AnimatePresence>

              <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-28">
                <div className={clsx('flex flex-col justify-end pb-4', currentInfoSection ? 'min-h-0 pt-8' : 'min-h-[calc(92vh-7rem)]')}>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 className="text-2xl font-black leading-tight text-white text-shadow-strong sm:text-3xl">
                        {title}
                      </h2>
                      {(episodeLabel || movieReleaseLabel) && (
                        <span className="text-[11px] font-black uppercase tracking-widest text-brand-cyan text-shadow-mild">
                          {episodeLabel || movieReleaseLabel}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-widest font-bold text-brand-silver">
                      <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm">{selected.media_type}</span>
                      {year && <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm">{year}</span>}
                      <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm">★ {selected.vote_average?.toFixed(1) || '0.0'}</span>
                      <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm">{contentRatingValue || 'N/A'}</span>
                    </div>

                    {selected.tagline && (
                      <p className="text-sm font-medium italic leading-relaxed text-white/85 text-shadow-mild">
                        {selected.tagline}
                      </p>
                    )}

                    <div className="grid grid-cols-4 gap-1.5 pt-1 sm:gap-2">
                      {([
                        { id: 'overview' as const, label: 'Overview', icon: Info },
                        { id: 'cast' as const, label: 'Cast', icon: Users },
                        { id: 'images' as const, label: 'Images', icon: ImageIcon },
                        { id: 'trailers' as const, label: 'Trailers', icon: Film },
                      ]).map((item) => {
                        const Icon = item.icon;
                        const isActive = currentInfoSection === item.id;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => !isActive && setActiveInfoSection({ id: selected.id, section: item.id })}
                            className={clsx(
                              'flex h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-1 text-[9px] font-black uppercase tracking-widest transition-all duration-200 sm:h-10 sm:flex-row sm:gap-2 sm:px-2 sm:text-[10px]',
                              isActive
                                ? 'border-brand-cyan/50 bg-brand-cyan/25 text-brand-cyan shadow-[0_0_18px_rgba(34,211,238,0.12)] hover:border-brand-cyan/70 hover:bg-brand-cyan/30 hover:shadow-[0_0_22px_rgba(34,211,238,0.16)]'
                                : 'border-white/15 bg-brand-bg/75 text-white hover:border-brand-cyan/30 hover:bg-brand-bg/90 hover:text-brand-cyan hover:shadow-[0_0_18px_rgba(34,211,238,0.08)]'
                            )}
                          >
                            <Icon size={13} className="shrink-0" />
                            <span className="min-w-0 truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>

                  {initError && (
                    <div className="flex items-center justify-between rounded-xl bg-red-900/20 border border-red-500/30 p-3">
                      <p className="text-xs font-medium text-red-200">Could not load details. Check your connection and try again.</p>
                      <button
                        type="button"
                        onClick={handleRetryInit}
                        className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-200 transition-all hover:bg-red-900/60 hover:border-red-400/60"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {currentInfoSection && (
                  <motion.div
                    key="panel"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="mt-3 min-h-[calc(92vh-15rem)] rounded-2xl bg-brand-bg/88 blueprint-border p-3 shadow-2xl shadow-black/35"
                  >
                    {currentInfoSection === 'overview' && (
                      sectionErrors.has('overview') ? (
                        <div className="flex flex-col items-center gap-3 py-10">
                          <p className="text-sm text-red-200">Failed to load overview.</p>
                          <button
                            type="button"
                            onClick={() => handleRetrySection('overview')}
                            className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-red-200 transition-all hover:bg-red-900/60 hover:border-red-400/60"
                          >
                            Retry
                          </button>
                        </div>
                      ) : currentLoadingInfoSection === 'overview' ? (
                        <div className="space-y-3">
                          <div className="h-24 rounded-xl skeleton-shimmer animate-shimmer" />
                          <div className="h-14 rounded-xl skeleton-shimmer animate-shimmer" />
                          {selected?.media_type === 'tv' && (
                            <div className="space-y-3 rounded-xl bg-white/[0.03] p-3">
                              <div className="h-3 w-20 rounded skeleton-shimmer animate-shimmer" />
                              {[...Array(3)].map((_, index) => (
                                <div key={index} className="flex gap-3">
                                  <div className="h-16 w-28 shrink-0 rounded-lg skeleton-shimmer animate-shimmer" />
                                  <div className="flex-1 space-y-2">
                                    <div className="h-3 w-32 rounded skeleton-shimmer animate-shimmer" />
                                    <div className="h-2 w-full rounded skeleton-shimmer animate-shimmer" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="rounded-xl bg-brand-bg/80 blueprint-border p-3">
                            <p className="text-sm leading-relaxed text-white/90">
                              {selected.overview || 'Overview unavailable.'}
                            </p>
                          </div>

                          <a
                            href={`https://www.justwatch.com/us/search?q=${encodeURIComponent(selected.title || selected.name || '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between gap-3 rounded-xl bg-brand-bg/80 blueprint-border p-3 transition-colors hover:bg-brand-bg"
                          >
                            <div className="min-w-0">
                              <p
                                className="text-sm text-white truncate"
                                title={watchProviderItems.length > 0 ? watchProviderItems.map((p) => p.provider_name).join(' · ') : ''}
                              >
                                {watchProviderItems.length > 0
                                  ? watchProviderItems.map((provider) => provider.provider_name).join(' · ')
                                  : 'No US providers found.'}
                              </p>
                              <p className="mt-1 text-[10px] uppercase tracking-widest text-brand-silver">
                                Streaming Providers - JustWatch.com
                              </p>
                            </div>
                            <Play className="shrink-0 text-brand-cyan" size={16} />
                          </a>

                          {(imdbUrl || commonSenseUrl) && (
                            <div className="flex flex-wrap gap-2 justify-center">
                              {imdbUrl && (
                                <a
                                  href={imdbUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1 rounded-lg border border-white/15 bg-brand-bg/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:border-brand-cyan/40 hover:bg-brand-cyan/15 hover:text-brand-cyan"
                                >
                                  IMDb
                                </a>
                              )}
                              {imdbUrl && (
                                <a
                                  href={`${imdbUrl}/parentalguide`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1 rounded-lg border border-white/15 bg-brand-bg/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:border-brand-cyan/40 hover:bg-brand-cyan/15 hover:text-brand-cyan"
                                >
                                  Parents Guide
                                </a>
                              )}
                              <a
                                href={commonSenseUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 rounded-lg border border-white/15 bg-brand-bg/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:border-brand-cyan/40 hover:bg-brand-cyan/15 hover:text-brand-cyan"
                              >
                                Common Sense
                              </a>
                            </div>
                          )}

                          {selected.media_type === 'tv' && (
                            <div className="rounded-xl bg-brand-bg/80 blueprint-border p-3">
                            <h3 className="mb-3 text-[11px] font-black uppercase tracking-widest text-brand-silver">Episodes</h3>
                            {seasonEpisodes?.id !== selected.id && seasonEpisodeItems.length === 0 ? (
                              <div className="space-y-3">
                                {[...Array(3)].map((_, index) => (
                                  <div key={index} className="flex gap-3">
                                    <div className="h-20 w-32 shrink-0 rounded-lg skeleton-shimmer animate-shimmer" />
                                    <div className="flex-1 space-y-2">
                                      <div className="h-3 w-32 rounded skeleton-shimmer animate-shimmer" />
                                      <div className="h-2 w-full rounded skeleton-shimmer animate-shimmer" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : seasonEpisodeItems.length > 0 ? (
                              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
                                {seasonEpisodeItems.map((episode) => (
                                  <motion.div key={episode.id} variants={staggerItem} className="flex gap-3 rounded-lg bg-white/[0.03] p-2">
                                    <div className="h-20 w-32 shrink-0">
                                      <div className="h-full w-full overflow-hidden rounded-lg bg-white/5">
                                        {episode.still_path ? (
                                          <img src={getImageUrl(episode.still_path, 'w342')} alt="" className="h-full w-full object-cover" decoding="async" loading="lazy" />
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[11px] font-black uppercase text-white">
                                        S{episode.season_number}E{episode.episode_number} · {episode.name}
                                      </p>
                                      {episode.air_date && (
                                        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-brand-silver/70">
                                          {new Date(episode.air_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                      )}
                                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-brand-silver">
                                        {episode.overview || 'Overview unavailable.'}
                                      </p>
                                    </div>
                                  </motion.div>
                                ))}
                              </motion.div>
                            ) : null}
                          </div>
                          )}
                        </div>
                      )
                    )}

                    {currentInfoSection === 'cast' && (
                      sectionErrors.has('cast') ? (
                        <div className="flex flex-col items-center gap-3 py-10">
                          <p className="text-sm text-red-200">Failed to load cast.</p>
                          <button
                            type="button"
                            onClick={() => handleRetrySection('cast')}
                            className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-red-200 transition-all hover:bg-red-900/60 hover:border-red-400/60"
                          >
                            Retry
                          </button>
                        </div>
                      ) : currentLoadingInfoSection === 'cast' ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {[...Array(6)].map((_, index) => (
                            <div key={index} className="aspect-[2/3] rounded-xl skeleton-shimmer animate-shimmer" />
                          ))}
                        </div>
                      ) : castItems.length > 0 ? (
                        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {castItems.map((member) => (
                            <motion.button
                              key={`${member.id}-${member.character}`}
                              variants={staggerItem}
                              type="button"
                              onClick={() => openActor(member)}
                              className="group overflow-hidden rounded-xl bg-brand-bg/80 blueprint-border text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-bg hover:border-brand-cyan/30 hover:shadow-[0_0_18px_rgba(34,211,238,0.08)] cursor-pointer"
                            >
                              <div className="aspect-[2/3] bg-white/5">
                                {member.profile_path ? (
                                  <img src={getImageUrl(member.profile_path, 'w342')} alt={member.name} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" decoding="async" loading="lazy" />
                                ) : null}
                              </div>
                              <div className="p-2">
                                <p className="truncate text-xs font-black text-white">{member.name}</p>
                                <p className="truncate text-[10px] text-brand-silver">{member.character}</p>
                              </div>
                            </motion.button>
                          ))}
                        </motion.div>
                      ) : (
                        <p className="py-10 text-center text-sm text-brand-silver">Cast unavailable.</p>
                      )
                    )}

                    {currentInfoSection === 'images' && (
                      sectionErrors.has('images') ? (
                        <div className="flex flex-col items-center gap-3 py-10">
                          <p className="text-sm text-red-200">Failed to load images.</p>
                          <button
                            type="button"
                            onClick={() => handleRetrySection('images')}
                            className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-red-200 transition-all hover:bg-red-900/60 hover:border-red-400/60"
                          >
                            Retry
                          </button>
                        </div>
                      ) : currentLoadingInfoSection === 'images' ? (
                        <div className="space-y-3">
                          {[...Array(4)].map((_, index) => (
                            <div key={index} className="aspect-video rounded-xl skeleton-shimmer animate-shimmer" />
                          ))}
                        </div>
                      ) : backdropItems.length > 0 ? (
                        <div className="space-y-3">
                          {backdropItems.map((image) => (
                            <img
                              key={image.file_path}
                              src={getImageUrl(image.file_path, 'w780')}
                              alt=""
                              className="aspect-video w-full rounded-xl object-cover blueprint-border"
                              decoding="async"
                              loading="lazy"
                              sizes="(max-width: 768px) 100vw, 780px"
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="py-10 text-center text-sm text-brand-silver">No backdrops.</p>
                      )
                    )}

                    {currentInfoSection === 'trailers' && (
                      sectionErrors.has('trailers') ? (
                        <div className="flex flex-col items-center gap-3 py-10">
                          <p className="text-sm text-red-200">Failed to load trailers.</p>
                          <button
                            type="button"
                            onClick={() => handleRetrySection('trailers')}
                            className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-red-200 transition-all hover:bg-red-900/60 hover:border-red-400/60"
                          >
                            Retry
                          </button>
                        </div>
                      ) : currentLoadingInfoSection === 'trailers' ? (
                        <div className="space-y-2">
                          {[...Array(4)].map((_, index) => (
                            <div key={index} className="aspect-video rounded-xl skeleton-shimmer animate-shimmer" />
                          ))}
                        </div>
                      ) : trailerItems.length > 0 ? (
                        <div className="space-y-3">
                          {trailerItems.map((video) => (
                            <div
                              key={video.id}
                              className="group block overflow-hidden rounded-xl bg-brand-bg/80 blueprint-border transition-colors hover:bg-brand-bg"
                            >
                              <div className="relative aspect-video bg-white/5">
                                {currentActiveTrailerId === video.id ? (
                                  <iframe
                                    src={`https://www.youtube.com/embed/${video.key}?autoplay=1`}
                                    title={video.name}
                                    className="h-full w-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setActiveTrailer({ mediaId: selected.id, videoId: video.id })}
                                    className="absolute inset-0 block h-full w-full text-left"
                                  >
                                    <img
                                      src={`https://img.youtube.com/vi/${video.key}/hqdefault.jpg`}
                                      alt=""
                                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                      loading="lazy"
                                      decoding="async"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-bg/75 text-brand-cyan border border-brand-cyan/35 backdrop-blur-sm">
                                        <Play size={20} className="ml-0.5" />
                                      </div>
                                    </div>
                                  </button>
                                )}
                              </div>

                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="py-10 text-center text-sm text-brand-silver">No trailers.</p>
                      )
                    )}

                    <p className="mt-3 text-center text-[10px] uppercase tracking-[0.2em] text-brand-silver/60 transition-colors duration-200 hover:text-brand-cyan/40">
                      Data provided by TMDB.
                    </p>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>

              <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/[0.04] bg-brand-bg/75 backdrop-blur-xl px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
                <div className="grid grid-cols-[1fr_56px_1fr] items-center gap-2">
                  <motion.button
                    type="button"
                    onClick={handleWatchedToggle}
                    title={inWatched ? 'Watched' : 'Mark Watched'}
                    aria-label={inWatched ? 'Watched' : 'Mark Watched'}
                    disabled={!!currentActionPulse}
                    animate={currentActionPulse === 'watched' ? { scale: [1, 1.06, 0.98, 1] } : { scale: 1 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className={clsx(
                      'flex h-11 w-full items-center justify-center gap-2 rounded-lg border px-3 text-xs font-black uppercase tracking-widest transition-all duration-200 hover:-translate-y-0.5',
                      inWatched
                        ? 'border-brand-cyan/40 bg-brand-cyan/30 text-brand-cyan hover:border-brand-cyan/70 hover:bg-brand-cyan/40 hover:text-white hover:shadow-[0_0_18px_rgba(34,211,238,0.14)]'
                        : 'border-white/15 bg-brand-bg/80 text-white hover:border-brand-cyan/30 hover:bg-brand-bg hover:text-brand-cyan hover:shadow-[0_0_18px_rgba(34,211,238,0.08)]'
                    )}
                  >
                    <Eye size={14} />
                    Watched
                  </motion.button>

                  <button
                    type="button"
                    onClick={closeDetails}
                    className="flex h-11 w-full items-center justify-center rounded-lg bg-white/10 text-brand-silver border border-white/15 transition-all hover:bg-brand-cyan/10 hover:text-brand-cyan hover:border-brand-cyan/25 hover:shadow-[0_0_12px_rgba(34,211,238,0.06)]"
                    aria-label="Close sheet"
                    title="Tap to close"
                  >
                    <ChevronDown size={18} />
                  </button>

                  <motion.button
                    type="button"
                    onClick={handleWatchlistToggle}
                    title={inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                    aria-label={inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                    disabled={!!currentActionPulse}
                    animate={currentActionPulse === 'watchlist' ? { scale: [1, 1.06, 0.98, 1] } : { scale: 1 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className={clsx(
                      'flex h-11 w-full items-center justify-center gap-2 rounded-lg border px-3 text-xs font-black uppercase tracking-widest transition-all duration-200 hover:-translate-y-0.5',
                      inWatchlist
                        ? 'border-brand-cyan/40 bg-brand-cyan/30 text-brand-cyan hover:border-brand-cyan/70 hover:bg-brand-cyan/40 hover:text-white hover:shadow-[0_0_18px_rgba(34,211,238,0.14)]'
                        : 'border-white/15 bg-brand-bg/80 text-white hover:border-brand-cyan/30 hover:bg-brand-bg hover:text-brand-cyan hover:shadow-[0_0_18px_rgba(34,211,238,0.08)]'
                    )}
                  >
                    <Bookmark size={14} />
                    Watchlist
                  </motion.button>
                </div>
              </div>
            </FocusTrap>
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
