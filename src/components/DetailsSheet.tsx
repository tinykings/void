'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { getImageUrl, getMediaCredits, getContentRating, getExternalIds, getMediaDetails, getMediaImages, getUSStreamingProviders, getWatchProviders } from '@/lib/tmdb';
import { getIgdbGameDetails } from '@/lib/igdb';
import { getImageSrc, getMediaKey, getMediaSource } from '@/lib/media';
import { CastMember, ExternalIdsResponse, Media, TmdbImage, WatchProvider } from '@/lib/types';
import { Bookmark, ChevronDown, ChevronLeft, ChevronRight, Eye, Heart, X } from 'lucide-react';
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
  const [watchProviders, setWatchProviders] = useState<{ id: number; items: WatchProvider[] } | null>(null);
  const [contentRating, setContentRating] = useState<{ id: number; value: string | null } | null>(null);
  const [externalIds, setExternalIds] = useState<{ id: number; value: ExternalIdsResponse | null } | null>(null);
  const [activeImage, setActiveImage] = useState<{ src: string; alt: string; mediaKey: string } | null>(null);
  const [actionPulse, setActionPulse] = useState<{ id: number; action: 'watchlist' | 'watched' | 'favorite' } | null>(null);
  const [showCastLeftButton, setShowCastLeftButton] = useState(false);
  const [showCastRightButton, setShowCastRightButton] = useState(false);
  const [showImageLeftButton, setShowImageLeftButton] = useState(false);
  const [showImageRightButton, setShowImageRightButton] = useState(false);
  const closeActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const castScrollerRef = useRef<HTMLDivElement | null>(null);
  const imageScrollerRef = useRef<HTMLDivElement | null>(null);
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

  const selected = activeDetailsMedia && details?.id === activeDetailsMedia.id && details.media.media_type === activeDetailsMedia.media_type && getMediaSource(details.media) === getMediaSource(activeDetailsMedia) ? details.media : activeDetailsMedia;
  const mediaKey = useMemo(() => {
    if (!selected) return '';
    return getMediaKey(selected);
  }, [selected]);

  const inWatchlist = mediaKey ? watchlistIds.has(mediaKey) : false;
  const inWatched = mediaKey ? watchedIds.has(mediaKey) : false;
  const isFavorited = inWatched && selected ? watchedMap.get(mediaKey)?.isFavorite ?? false : false;
  const castItems = selected && cast?.id === selected.id ? cast.items : [];
  const backdropItems = selected && backdrops?.id === selected.id ? backdrops.items : [];
  const watchProviderItems = selected && watchProviders?.id === selected.id ? watchProviders.items : [];
  const contentRatingValue = selected && contentRating?.id === selected.id ? contentRating.value : null;
  const externalIdsValue = selected && externalIds?.id === selected.id ? externalIds.value : null;
  const imdbUrl = externalIdsValue?.imdb_id ? `https://www.imdb.com/title/${externalIdsValue.imdb_id}` : '';
  const currentActionPulse = selected && actionPulse?.id === selected.id ? actionPulse.action : null;
  const railButtonClass = 'absolute inset-y-0 z-10 flex w-10 items-center justify-center rounded-lg border border-brand-cyan/25 bg-brand-bg/85 text-brand-cyan backdrop-blur-md transition-colors hover:bg-brand-cyan/15 hover:text-white';

  function scrollCast(direction: 'left' | 'right') {
    const scroller = castScrollerRef.current;
    if (!scroller) return;

    scroller.scrollBy({
      left: direction === 'left' ? -scroller.clientWidth * 0.85 : scroller.clientWidth * 0.85,
      behavior: 'smooth',
    });
  }

  function handleCastScroll() {
    const scroller = castScrollerRef.current;
    setShowCastLeftButton(!!scroller && scroller.scrollLeft > 4);
    setShowCastRightButton(!!scroller && scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 4);
  }

  function scrollImages(direction: 'left' | 'right') {
    const scroller = imageScrollerRef.current;
    if (!scroller) return;

    scroller.scrollBy({
      left: direction === 'left' ? -scroller.clientWidth * 0.85 : scroller.clientWidth * 0.85,
      behavior: 'smooth',
    });
  }

  function handleImageScroll() {
    const scroller = imageScrollerRef.current;
    setShowImageLeftButton(!!scroller && scroller.scrollLeft > 4);
    setShowImageRightButton(!!scroller && scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 4);
  }

  useEffect(() => {
    if (!activeDetailsMedia) return;
    if (activeDetailsMedia.media_type !== 'game' && !apiKey) return;
    if (details?.id === activeDetailsMedia.id && details.media.media_type === activeDetailsMedia.media_type && getMediaSource(details.media) === getMediaSource(activeDetailsMedia)) return;

    let cancelled = false;

    const source = getMediaSource(activeDetailsMedia);
    const detailsPromise = activeDetailsMedia.media_type === 'game'
      ? source === 'steam'
        ? Promise.resolve(activeDetailsMedia)
        : getIgdbGameDetails(activeDetailsMedia.id)
      : getMediaDetails(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey);

    detailsPromise
      .then((mediaData) => {
        if (cancelled) return;
        return mediaData;
      })
      .then((mediaData) => {
        if (cancelled || !mediaData) return;
        setDetails({ id: mediaData.id, media: mediaData });
        updateMediaMetadata(mediaData.id, mediaData.media_type, {
          ...mediaData,
          lastChecked: Date.now(),
        }, getMediaSource(mediaData));
      })
      .catch(() => {
        if (!cancelled) setInitError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [activeDetailsMedia, apiKey, details?.id, details?.media, updateMediaMetadata, retryCount]);

  useEffect(() => {
    return () => {
      if (closeActionTimerRef.current) clearTimeout(closeActionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activeImage) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveImage(null);
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeImage]);

  useEffect(() => {
    if (castScrollerRef.current) castScrollerRef.current.scrollLeft = 0;
    if (imageScrollerRef.current) imageScrollerRef.current.scrollLeft = 0;
    queueMicrotask(() => {
      setShowCastLeftButton(false);
      setShowCastRightButton(false);
      setShowImageLeftButton(false);
      setShowImageRightButton(false);
    });
  }, [mediaKey]);

  useEffect(() => {
    queueMicrotask(handleCastScroll);
  }, [castItems.length, mediaKey]);

  useEffect(() => {
    queueMicrotask(handleImageScroll);
  }, [backdropItems.length, mediaKey, selected?.screenshots?.length]);

  useEffect(() => {
    if (!activeDetailsMedia || !apiKey || !details || details.id !== activeDetailsMedia.id || activeDetailsMedia.media_type === 'game') return;

    let cancelled = false;
    const tmdbType = activeDetailsMedia.media_type;

    const fetchData = async () => {
      await Promise.all([
        (async () => {
          if (watchProviders?.id === activeDetailsMedia.id) return;
          try {
            const data = await getWatchProviders(activeDetailsMedia.id, tmdbType, apiKey);
            if (!cancelled) setWatchProviders({ id: activeDetailsMedia.id, items: getUSStreamingProviders(data) });
          } catch {
            if (!cancelled) setSectionErrors(prev => new Set(prev).add('overview'));
          }
        })(),
        (async () => {
          if (cast?.id === activeDetailsMedia.id) return;
          try {
            const data = await getMediaCredits(activeDetailsMedia.id, tmdbType, apiKey);
            if (!cancelled) setCast({ id: activeDetailsMedia.id, items: data.cast.slice(0, 20) });
          } catch {
            if (!cancelled) setSectionErrors(prev => new Set(prev).add('cast'));
          }
        })(),
        (async () => {
          if (backdrops?.id === activeDetailsMedia.id) return;
          try {
            const data = await getMediaImages(activeDetailsMedia.id, tmdbType, apiKey);
            if (!cancelled) {
              const selectedBackdrops = [...(data.backdrops || [])]
                .sort((a, b) => {
                  const voteCountDiff = b.vote_count - a.vote_count;
                  if (voteCountDiff !== 0) return voteCountDiff;
                  return b.vote_average - a.vote_average;
                })
                .slice(0, 20);
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
  }, [activeDetailsMedia, apiKey, details, watchProviders?.id, cast?.id, backdrops?.id, retryCount]);

  useEffect(() => {
    if (!activeDetailsMedia || !apiKey || activeDetailsMedia.media_type === 'game') return;

    let cancelled = false;
    const tmdbType = activeDetailsMedia.media_type;

    getContentRating(activeDetailsMedia.id, tmdbType, apiKey)
      .then((rating) => {
        if (!cancelled) setContentRating({ id: activeDetailsMedia.id, value: rating });
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [activeDetailsMedia, apiKey]);

  useEffect(() => {
    if (!activeDetailsMedia || !apiKey || activeDetailsMedia.media_type === 'game') return;

    let cancelled = false;
    const tmdbType = activeDetailsMedia.media_type;

    getExternalIds(activeDetailsMedia.id, tmdbType, apiKey)
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
  const isGame = selected.media_type === 'game';
  const ggDealsUrl = isGame ? `https://gg.deals/search/?title=${encodeURIComponent(title)}` : '';
  const source = getMediaSource(selected);
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
  const providerLabel = source === 'igdb' ? 'IGDB' : source === 'rawg' ? 'RAWG' : source === 'steam' ? 'Steam' : 'TMDB';
  const posterSrc = getImageSrc(selected.poster_path, (tmdbPath) => getImageUrl(tmdbPath, 'w342'));
  const gameScreenshots = isGame ? (selected.screenshots || []).slice(0, 20) : [];
  const trailerSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} trailer`)}`;
  const showImageSection = isGame
    ? gameScreenshots.length > 0
    : sectionErrors.has('images') || backdrops?.id !== selected.id || backdropItems.length > 0;
  const externalLinks = [
    { label: 'Trailer', url: trailerSearchUrl },
    imdbUrl ? { label: 'IMDb', url: imdbUrl } : null,
    !isGame && watchProviderItems.length > 0 ? { label: 'JustWatch', url: `https://www.justwatch.com/us/search?q=${encodeURIComponent(title)}` } : null,
    selected.source_url && source !== 'igdb' ? { label: providerLabel, url: selected.source_url } : null,
    ggDealsUrl ? { label: 'GG.deals', url: ggDealsUrl } : null,
    selected.website ? { label: 'Website', url: selected.website } : null,
    !isGame ? { label: 'Cineby', url: `https://www.cineby.sc/${selected.media_type}/${selected.id}` } : null,
  ].filter((link): link is { label: string; url: string } => !!link && !!link.url);
  const renderImageGrid = (items: { src: string; alt: string }[]) => (
    <div className="relative">
      {showImageLeftButton && (
        <button
          type="button"
          onClick={() => scrollImages('left')}
          className={`${railButtonClass} left-0`}
          aria-label="Scroll images left"
          title="Scroll images left"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      <motion.div
        ref={imageScrollerRef}
        onScroll={handleImageScroll}
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="flex snap-x gap-2 overflow-x-auto scroll-smooth pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((image) => (
          <motion.button
            key={image.src}
            variants={staggerItem}
            type="button"
            onClick={() => setActiveImage({ ...image, mediaKey })}
            className="group w-[31%] shrink-0 snap-start overflow-hidden rounded-xl bg-white/5 blueprint-border transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-cyan/35 hover:shadow-[0_0_18px_rgba(34,211,238,0.08)] sm:w-[23.5%] md:w-[18.4%]"
          >
            <img
              src={image.src}
              alt={image.alt}
              className="aspect-square w-full object-cover transition-transform duration-200 group-hover:scale-105"
              decoding="async"
              loading="lazy"
            />
          </motion.button>
        ))}
      </motion.div>
      {showImageRightButton && (
        <button
          type="button"
          onClick={() => scrollImages('right')}
          className={`${railButtonClass} right-0`}
          aria-label="Scroll images right"
          title="Scroll images right"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
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
        title: 'Remove from Playlist',
        message: `Remove \"${title}\" from your playlist?`,
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
        title: 'Remove from History',
        message: `Remove \"${title}\" from history?`,
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
              <FocusTrap active={isOpen}>
              <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-28">
                <div className="flex gap-4 pb-4 pt-4">
                  {posterSrc && (
                    <img
                      src={posterSrc}
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
                      <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm">{isGame ? 'game' : selected.media_type}</span>
                      {year && <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm">{year}</span>}
                      <span className={clsx('px-2 py-1 rounded-full backdrop-blur-sm', (selected.vote_average ?? 0) >= 7 ? 'bg-brand-cyan/10 text-brand-cyan' : 'bg-white/10 text-brand-silver')}>★ {selected.vote_average?.toFixed(1) || '0.0'}</span>
                      {!isGame && <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm">{contentRatingValue || 'N/A'}</span>}
                      {isGame && selected.metacritic ? <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm">MC {selected.metacritic}</span> : null}
                      {isGame && selected.playtime ? <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm">{selected.playtime}H</span> : null}

                    </div>

                    <p className="text-sm leading-relaxed text-white/90 line-clamp-6">
                      {selected.overview || 'Overview unavailable.'}
                    </p>
                    {watchProviderItems.length > 0 && (
                      <p className="text-xs text-brand-silver">
                        {watchProviderItems.map((p) => p.provider_name).join(' · ')}
                      </p>
                    )}
                    {isGame && selected.platforms && selected.platforms.length > 0 && (
                      <p className="text-xs text-brand-silver">
                        {selected.platforms.slice(0, 8).join(' · ')}
                      </p>
                    )}
                    {isGame && selected.genres && selected.genres.length > 0 && (
                      <p className="text-xs text-brand-silver/80">
                        {selected.genres.slice(0, 6).join(' · ')}
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
                  {externalLinks.length > 0 && (
                    <div className="rounded-xl bg-brand-bg/80 blueprint-border p-3">
                      <div className="flex flex-wrap justify-center gap-2">
                        {externalLinks.map((link) => (
                          <a
                            key={`${link.label}-${link.url}`}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-xs font-black uppercase tracking-widest text-brand-silver transition-colors hover:border-brand-cyan/35 hover:bg-brand-cyan/10 hover:text-white"
                          >
                            {link.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isGame && (
                    <>
                    {/* Cast */}
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
                        <div className="flex gap-2 overflow-hidden">
                          {[...Array(5)].map((_, index) => (
                            <div key={index} className="aspect-square w-[31%] shrink-0 rounded-xl skeleton-shimmer animate-shimmer sm:w-[23.5%] md:w-[18.4%]" />
                          ))}
                        </div>
                      ) : castItems.length > 0 ? (
                        <div className="relative">
                          {showCastLeftButton && (
                            <button
                              type="button"
                              onClick={() => scrollCast('left')}
                              className={`${railButtonClass} left-0`}
                              aria-label="Scroll cast left"
                              title="Scroll cast left"
                            >
                              <ChevronLeft size={18} />
                            </button>
                          )}
                          <motion.div
                            ref={castScrollerRef}
                            onScroll={handleCastScroll}
                            variants={staggerContainer}
                            initial="hidden"
                            animate="visible"
                            className="flex snap-x gap-2 overflow-x-auto scroll-smooth pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                          >
                            {castItems.map((member) => (
                              <motion.button
                                key={`${member.id}-${member.character}`}
                                variants={staggerItem}
                                type="button"
                                onClick={() => openActor(member)}
                                className="group w-[31%] shrink-0 snap-start overflow-hidden rounded-xl bg-brand-bg/80 blueprint-border text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-bg hover:border-brand-cyan/30 hover:shadow-[0_0_18px_rgba(34,211,238,0.08)] cursor-pointer sm:w-[23.5%] md:w-[18.4%]"
                              >
                                <div className="aspect-square bg-white/5">
                                  {member.profile_path ? (
                                    <img src={getImageUrl(member.profile_path, 'w342')} alt={member.name} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" decoding="async" loading="lazy" />
                                  ) : null}
                                </div>
                                <div className="p-2">
                                  <p className="break-words text-xs font-black leading-tight text-white">{member.name}</p>
                                  <p className="truncate text-[10px] text-brand-silver">{member.character}</p>
                                </div>
                              </motion.button>
                            ))}
                          </motion.div>
                          {showCastRightButton && (
                            <button
                              type="button"
                              onClick={() => scrollCast('right')}
                              className={`${railButtonClass} right-0`}
                              aria-label="Scroll cast right"
                              title="Scroll cast right"
                            >
                              <ChevronRight size={18} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="py-10 text-center text-sm text-brand-silver">Cast unavailable.</p>
                      )}
                    </div>
                    </>
                  )}

                    {/* Images */}
                    {showImageSection && (
                      <div className="rounded-xl bg-brand-bg/80 blueprint-border p-3">
                        <h3 className="mb-3 text-[11px] font-black uppercase tracking-widest text-brand-silver">Images</h3>
                        {isGame ? (
                          renderImageGrid(gameScreenshots.map((image, index) => ({
                            src: image,
                            alt: `${title} screenshot ${index + 1}`,
                          })))
                        ) : sectionErrors.has('images') ? (
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
                          <div className="flex gap-2 overflow-hidden">
                            {[...Array(3)].map((_, index) => (
                              <div key={index} className="aspect-square w-[31%] shrink-0 rounded-xl skeleton-shimmer animate-shimmer sm:w-[23.5%] md:w-[18.4%]" />
                            ))}
                          </div>
                        ) : (
                          renderImageGrid(backdropItems.map((image, index) => ({
                            src: getImageUrl(image.file_path, 'w780'),
                            alt: `${title} image ${index + 1}`,
                          })))
                        )}
                      </div>
                    )}

                <p className="text-center text-[10px] uppercase tracking-[0.2em] text-brand-silver/60">
                  Data provided by {providerLabel}.
                </p>
              </div>
              </div>

              <AnimatePresence>
                {activeImage?.mediaKey === mediaKey && (
                  <div className="fixed inset-0 z-[380] flex items-center justify-center p-4" onClick={() => setActiveImage(null)}>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/90 backdrop-blur-sm"
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      className="relative z-10 max-h-full max-w-6xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveImage(null)}
                        className="absolute right-2 top-2 z-20 rounded-lg border border-brand-cyan/25 bg-brand-bg/75 p-3 text-brand-cyan backdrop-blur-md transition-colors hover:bg-brand-cyan/15 hover:text-white"
                        title="Close image"
                        aria-label="Close image"
                      >
                        <X size={18} />
                      </button>
                      <img
                        src={activeImage.src}
                        alt={activeImage.alt}
                        className="max-h-[88vh] max-w-full rounded-2xl object-contain blueprint-border shadow-2xl shadow-black/60"
                        decoding="async"
                      />
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/[0.04] bg-brand-bg/75 backdrop-blur-xl px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
                <div className={clsx('grid items-center gap-2', inWatched ? 'grid-cols-[1fr_56px_56px_1fr]' : 'grid-cols-[1fr_56px_1fr]')}>
                  <motion.button
                    type="button"
                    onClick={handleWatchedToggle}
                    title={inWatched ? 'In History' : 'Add to History'}
                    aria-label={inWatched ? 'In History' : 'Add to History'}
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
                    History
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
                    title={inWatchlist ? 'In Playlist' : 'Add to Playlist'}
                    aria-label={inWatchlist ? 'In Playlist' : 'Add to Playlist'}
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
                    Playlist
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
