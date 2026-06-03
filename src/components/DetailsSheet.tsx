'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { getImageUrl, getMediaCredits, getContentRating, getExternalIds, getMediaDetails, getMediaImages, getMediaVideos, getUSStreamingProviders, getWatchProviders } from '@/lib/tmdb';
import { CastMember, ExternalIdsResponse, Media, TmdbImage, Video, WatchProvider } from '@/lib/types';
import { Bookmark, ChevronDown, ExternalLink, Eye, Heart, Play } from 'lucide-react';
import { clsx } from 'clsx';
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

export const DetailsSheet = () => {
  const {
    activeDetailsMedia,
    closeDetails,
    apiKey,
    watchlistIds,
    watchedIds,
    watchedMap,
    openActor,
    closeAllSheets,
    toggleWatchlist,
    toggleWatched,
    toggleFavorite,
    updateMediaMetadata,
  } = useAppContext();

  const [details, setDetails] = useState<{ id: number; media: Media } | null>(null);
  const [cast, setCast] = useState<{ id: number; items: CastMember[] } | null>(null);
  const [backdrops, setBackdrops] = useState<{ id: number; items: TmdbImage[] } | null>(null);
  const [trailers, setTrailers] = useState<{ id: number; items: Video[] } | null>(null);
  const [watchProviders, setWatchProviders] = useState<{ id: number; items: WatchProvider[] } | null>(null);
  const [contentRating, setContentRating] = useState<{ id: number; value: string | null } | null>(null);
  const [externalIds, setExternalIds] = useState<{ id: number; value: ExternalIdsResponse | null } | null>(null);
  const [activeTrailer, setActiveTrailer] = useState<{ mediaId: number; videoId: string } | null>(null);
  const [showLinks, setShowLinks] = useState(false);
  const [actionPulse, setActionPulse] = useState<{ id: number; action: 'watchlist' | 'watched' | 'favorite' } | null>(null);
  const closeActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linksRef = useRef<HTMLDivElement | null>(null);
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
  const isFavorited = inWatched && selected ? watchedMap.get(mediaKey)?.isFavorite ?? false : false;
  const castItems = selected && cast?.id === selected.id ? cast.items : [];
  const backdropItems = selected && backdrops?.id === selected.id ? backdrops.items : [];
  const trailerItems = selected && trailers?.id === selected.id ? trailers.items : [];
  const watchProviderItems = selected && watchProviders?.id === selected.id ? watchProviders.items : [];
  const contentRatingValue = selected && contentRating?.id === selected.id ? contentRating.value : null;
  const externalIdsValue = selected && externalIds?.id === selected.id ? externalIds.value : null;
  const imdbUrl = externalIdsValue?.imdb_id ? `https://www.imdb.com/title/${externalIdsValue.imdb_id}` : '';
  const commonSenseUrl = selected ? `https://www.commonsensemedia.org/search/${encodeURIComponent(selected.title || selected.name || '')}` : '';
  const currentActionPulse = selected && actionPulse?.id === selected.id ? actionPulse.action : null;
  const currentActiveTrailerId = selected && activeTrailer?.mediaId === selected.id ? activeTrailer.videoId : null;

  useEffect(() => {
    if (!activeDetailsMedia || !apiKey || details?.id === activeDetailsMedia.id) return;

    let cancelled = false;

    getMediaDetails(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey)
      .then((mediaData) => {
        if (cancelled) return;
        setDetails({ id: mediaData.id, media: mediaData });
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
  }, [activeDetailsMedia, apiKey, details?.id, updateMediaMetadata, retryCount]);

  useEffect(() => {
    return () => {
      if (closeActionTimerRef.current) clearTimeout(closeActionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showLinks) return;
    const handler = (e: MouseEvent) => {
      if (linksRef.current && !linksRef.current.contains(e.target as Node)) {
        setShowLinks(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLinks]);

  useEffect(() => {
    if (!activeDetailsMedia || !apiKey || !details || details.id !== activeDetailsMedia.id) return;

    let cancelled = false;

    const fetchData = async () => {
      await Promise.all([
        (async () => {
          if (watchProviders?.id === activeDetailsMedia.id) return;
          try {
            const data = await getWatchProviders(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey);
            if (!cancelled) setWatchProviders({ id: activeDetailsMedia.id, items: getUSStreamingProviders(data) });
          } catch {
            if (!cancelled) setSectionErrors(prev => new Set(prev).add('overview'));
          }
        })(),
        (async () => {
          if (cast?.id === activeDetailsMedia.id) return;
          try {
            const data = await getMediaCredits(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey);
            if (!cancelled) setCast({ id: activeDetailsMedia.id, items: data.cast.slice(0, 8) });
          } catch {
            if (!cancelled) setSectionErrors(prev => new Set(prev).add('cast'));
          }
        })(),
        (async () => {
          if (trailers?.id === activeDetailsMedia.id) return;
          try {
            const data = await getMediaVideos(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey);
            if (!cancelled) {
              const selectedTrailers = [...(data.results || [])]
                .filter((v) => v.site === 'YouTube' && v.type === 'Trailer')
                .sort((a, b) => {
                  if (a.official !== b.official) return a.official ? -1 : 1;
                  return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
                })
                .slice(0, 2);
              setTrailers({ id: activeDetailsMedia.id, items: selectedTrailers });
            }
          } catch {
            if (!cancelled) setSectionErrors(prev => new Set(prev).add('trailers'));
          }
        })(),
        (async () => {
          if (backdrops?.id === activeDetailsMedia.id) return;
          try {
            const data = await getMediaImages(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey);
            if (!cancelled) {
              const selectedBackdrops = [...(data.backdrops || [])]
                .sort((a, b) => {
                  const voteCountDiff = b.vote_count - a.vote_count;
                  if (voteCountDiff !== 0) return voteCountDiff;
                  return b.vote_average - a.vote_average;
                })
                .slice(0, 5);
              setBackdrops({ id: activeDetailsMedia.id, items: selectedBackdrops });
            }
          } catch {
            if (!cancelled) setSectionErrors(prev => new Set(prev).add('images'));
          }
        })(),
      ]);
    };

    fetchData();

    return () => { cancelled = true; };
  }, [activeDetailsMedia, apiKey, details, watchProviders?.id, cast?.id, trailers?.id, backdrops?.id, retryCount]);

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
  const runAction = async (action: 'watchlist' | 'watched', commit: () => Promise<void> | void) => {
    if (closeActionTimerRef.current) clearTimeout(closeActionTimerRef.current);

    setActionPulse({ id: selected.id, action });
    await Promise.resolve(commit());

    closeActionTimerRef.current = setTimeout(() => {
      setActionPulse(null);
    }, 400);
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
          await runAction('watchlist', () => toggleWatchlist(selected));
          setModalConfig(c => ({ ...c, isOpen: false }));
        },
      });
      return;
    }

    void runAction('watchlist', () => toggleWatchlist(selected));
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
          await runAction('watched', () => toggleWatched(selected));
          setModalConfig(c => ({ ...c, isOpen: false }));
        },
      });
      return;
    }

    void runAction('watched', () => toggleWatched(selected));
  };

  const handleFavoriteToggle = () => {
    if (!inWatched) return;
    void runAction('favorite' as 'watchlist' | 'watched', () => toggleFavorite(selected));
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
              className="relative w-full max-w-6xl h-[92vh] max-h-[96vh] bg-brand-bg/95 embossed-edge rounded-t-3xl overflow-hidden flex flex-col will-change-transform"
            >
              {(imdbUrl || commonSenseUrl) && (
                <div className="absolute top-4 right-4 z-20" ref={linksRef}>
                  <button
                    type="button"
                    onClick={() => setShowLinks(v => !v)}
                    title="External links"
                    aria-label="External links"
                    className="flex items-center gap-2 text-brand-cyan/80 hover:text-brand-cyan transition-colors outline-none"
                  >
                    <ExternalLink size={32} />
                  </button>
                  {showLinks && (
                    <div className="absolute top-full right-0 mt-2 rounded-lg bg-brand-bg border border-white/15 shadow-xl shadow-black/40 overflow-hidden z-40 whitespace-nowrap">
                      {imdbUrl && (
                        <a href={imdbUrl} target="_blank" rel="noreferrer" className="block px-3 py-2 text-sm text-brand-silver hover:text-white hover:bg-white/5 transition-colors">
                            IMDb
                        </a>
                      )}
                      {imdbUrl && (
                        <a href={`${imdbUrl}/parentalguide`} target="_blank" rel="noreferrer" className="block px-3 py-2 text-sm text-brand-silver hover:text-white hover:bg-white/5 transition-colors">
                            Parents Guide
                        </a>
                      )}
                      <a href={commonSenseUrl} target="_blank" rel="noreferrer" className="block px-3 py-2 text-sm text-brand-silver hover:text-white hover:bg-white/5 transition-colors">
                        Common Sense
                      </a>
                      <div className="border-t border-white/10 my-1" />
                      {watchProviderItems.length > 0 && (
                        <a
                          href={`https://www.justwatch.com/us/search?q=${encodeURIComponent(selected.title || selected.name || '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-brand-silver hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <span>JustWatch</span>
                        </a>
                      )}
                      <a
                        href={`https://www.cineby.sc/${selected.media_type}/${selected.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-brand-silver hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <span>Cineby</span>
                      </a>
                    </div>
                  )}
                </div>
              )}
              <FocusTrap active={isOpen}>
              <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-28">
                <div className="flex gap-4 pb-4 pt-4">
                  {selected.poster_path && (
                    <img
                      src={getImageUrl(selected.poster_path, 'w342')}
                      alt=""
                      className="w-24 sm:w-32 rounded-xl object-cover shrink-0 self-start blueprint-border"
                      decoding="async"
                      loading="lazy"
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 className="text-2xl font-black leading-tight text-white sm:text-3xl">
                        {title}
                      </h2>
                      {(episodeLabel || movieReleaseLabel) && (
                        <span className="text-[11px] font-black uppercase tracking-widest text-brand-cyan">
                          {episodeLabel || movieReleaseLabel}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-widest font-bold text-brand-silver">
                      <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm">{selected.media_type}</span>
                      {year && <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm">{year}</span>}
                      <span className={clsx('px-2 py-1 rounded-full backdrop-blur-sm', (selected.vote_average ?? 0) >= 7 ? 'bg-brand-cyan/10 text-brand-cyan' : 'bg-white/10 text-brand-silver')}>★ {selected.vote_average?.toFixed(1) || '0.0'}</span>
                      <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm">{contentRatingValue || 'N/A'}</span>

                    </div>

                    <p className="text-sm leading-relaxed text-white/90 line-clamp-6">
                      {selected.overview || 'Overview unavailable.'}
                    </p>
                    {watchProviderItems.length > 0 && (
                      <p className="text-xs text-brand-silver">
                        {watchProviderItems.map((p) => p.provider_name).join(' · ')}
                      </p>
                    )}

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

              <div className="mt-3 space-y-4">
                    {/* Trailers */}
                    <div className="rounded-xl bg-brand-bg/80 blueprint-border p-3">
                      <h3 className="mb-3 text-[11px] font-black uppercase tracking-widest text-brand-silver">Trailers</h3>
                      {sectionErrors.has('trailers') ? (
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
                      ) : trailers?.id !== selected.id ? (
                        <div className="space-y-2">
                          {[...Array(2)].map((_, index) => (
                            <div key={index} className="aspect-video rounded-xl skeleton-shimmer animate-shimmer" />
                          ))}
                        </div>
                      ) : trailerItems.length > 0 ? (
                        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {trailerItems.map((video) => (
                            <motion.div
                              key={video.id}
                              variants={staggerItem}
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
                            </motion.div>
                          ))}
                        </motion.div>
                      ) : (
                        <p className="py-10 text-center text-sm text-brand-silver">No trailers.</p>
                      )}
                    </div>

                    {/* Cast (limited to 4) */}
                    <div className="rounded-xl bg-brand-bg/80 blueprint-border p-3">
                      <h3 className="mb-3 text-[11px] font-black uppercase tracking-widest text-brand-silver">Cast</h3>
                      {sectionErrors.has('cast') ? (
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
                      ) : cast?.id !== selected.id ? (
                        <div className="grid grid-cols-4 gap-3">
                          {[...Array(4)].map((_, index) => (
                            <div key={index} className="aspect-[2/3] rounded-xl skeleton-shimmer animate-shimmer" />
                          ))}
                        </div>
                      ) : castItems.length > 0 ? (
                        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-4 gap-3">
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
                      )}
                    </div>

                    {/* Images */}
                    <div className="rounded-xl bg-brand-bg/80 blueprint-border p-3">
                      <h3 className="mb-3 text-[11px] font-black uppercase tracking-widest text-brand-silver">Images</h3>
                      {sectionErrors.has('images') ? (
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
                      ) : backdrops?.id !== selected.id ? (
                        <div className="space-y-3">
                          {[...Array(3)].map((_, index) => (
                            <div key={index} className="aspect-video rounded-xl skeleton-shimmer animate-shimmer" />
                          ))}
                        </div>
                      ) : backdropItems.length > 0 ? (
                        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
                          {backdropItems.map((image) => (
                            <motion.img
                              key={image.file_path}
                              variants={staggerItem}
                              src={getImageUrl(image.file_path, 'w780')}
                              alt=""
                              className="aspect-video w-full rounded-xl object-cover blueprint-border"
                              decoding="async"
                              loading="lazy"
                              sizes="(max-width: 768px) 100vw, 780px"
                            />
                          ))}
                        </motion.div>
                      ) : (
                        <p className="py-10 text-center text-sm text-brand-silver">No backdrops.</p>
                      )}
                    </div>

                <p className="text-center text-[10px] uppercase tracking-[0.2em] text-brand-silver/60">
                  Data provided by TMDB.
                </p>
              </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/[0.04] bg-brand-bg/75 backdrop-blur-xl px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
                <div className={clsx('grid items-center gap-2', inWatched ? 'grid-cols-[1fr_56px_56px_1fr]' : 'grid-cols-[1fr_56px_1fr]')}>
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

                  {inWatched && (
                    <motion.button
                      type="button"
                      onClick={handleFavoriteToggle}
                      title={isFavorited ? 'Favorited' : 'Mark Favorite'}
                      aria-label={isFavorited ? 'Favorited' : 'Mark Favorite'}
                      disabled={!!currentActionPulse}
                      animate={currentActionPulse === 'favorite' ? { scale: [1, 1.06, 0.98, 1] } : { scale: 1 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className={clsx(
                        'flex h-11 w-full items-center justify-center rounded-lg border transition-all duration-200',
                        isFavorited
                          ? 'border-red-400/40 bg-red-500/20 text-red-300 hover:border-red-400/70 hover:bg-red-500/30 hover:text-white hover:shadow-[0_0_18px_rgba(239,68,68,0.14)] hover:-translate-y-0.5'
                          : 'border-white/15 bg-brand-bg/80 text-white hover:border-red-400/30 hover:bg-brand-bg hover:text-red-300 hover:shadow-[0_0_18px_rgba(239,68,68,0.08)] hover:-translate-y-0.5'
                      )}
                    >
                      <Heart size={16} className={isFavorited ? 'fill-current' : ''} />
                    </motion.button>
                  )}

                  <button
                    type="button"
                    onClick={closeDetails}
                    className="flex h-11 w-full items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/25 shadow-[0_0_15px_rgba(34,211,238,0.1)] transition-all hover:bg-brand-cyan/20 hover:text-white hover:border-brand-cyan/40"
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
