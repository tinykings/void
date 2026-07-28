'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { getImageUrl } from '@/lib/tmdb';
import { formatGamePrice, getSteamAppId } from '@/lib/ggDeals';
import { getImageSrc, getMediaKey, getMediaSource, getMediaTitle } from '@/lib/media';
import { Video } from '@/lib/types';
import { Bookmark, ChevronDown, ChevronLeft, ChevronRight, Eye, Heart, Play, X } from 'lucide-react';
import { clsx } from 'clsx';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { FocusTrap } from '@/components/FocusTrap';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useMediaDetails } from '@/hooks/useMediaDetails';
import { useDetailsSupplementaryData } from '@/hooks/useDetailsSupplementaryData';
import { useGamePrice } from '@/hooks/useGamePrice';

export const DetailsSheet = () => {
  const isOnline = useOnlineStatus();
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

  const [activeImage, setActiveImage] = useState<{ src: string; alt: string; mediaKey: string } | null>(null);
  const [activeTrailer, setActiveTrailer] = useState<{ video: Video; mediaKey: string } | null>(null);
  const [actionPulse, setActionPulse] = useState<{ key: string; action: 'watchlist' | 'watched' | 'favorite' } | null>(null);
  const [showCastLeftButton, setShowCastLeftButton] = useState(false);
  const [showCastRightButton, setShowCastRightButton] = useState(false);
  const [showImageLeftButton, setShowImageLeftButton] = useState(false);
  const [showImageRightButton, setShowImageRightButton] = useState(false);
  const [showTrailerLeftButton, setShowTrailerLeftButton] = useState(false);
  const [showTrailerRightButton, setShowTrailerRightButton] = useState(false);
  const closeActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const castScrollerRef = useRef<HTMLDivElement | null>(null);
  const imageScrollerRef = useRef<HTMLDivElement | null>(null);
  const trailerScrollerRef = useRef<HTMLDivElement | null>(null);
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

  const {
    errorKey: initErrorKey,
    isResolved: hasResolvedDetails,
    retry: handleRetryInit,
    selected,
  } = useMediaDetails({
    activeMedia: activeDetailsMedia,
    apiKey,
    isOnline,
    updateMediaMetadata,
  });

  const mediaKey = useMemo(() => {
    if (!selected) return '';
    return getMediaKey(selected);
  }, [selected]);

  const inWatchlist = mediaKey ? watchlistIds.has(mediaKey) : false;
  const inWatched = mediaKey ? watchedIds.has(mediaKey) : false;
  const isFavorited = inWatched && selected ? watchedMap.get(mediaKey)?.isFavorite ?? false : false;
  const {
    backdropItems,
    backdropsKey,
    castItems,
    castKey,
    contentRatingValue,
    retrySection: handleRetrySection,
    sectionErrors,
    watchProviderItems,
  } = useDetailsSupplementaryData({
    activeKey: mediaKey,
    activeMedia: activeDetailsMedia,
    apiKey,
    enabled: hasResolvedDetails,
    isOnline,
  });
  const steamAppId = selected?.media_type === 'game' ? getSteamAppId(selected) : undefined;
  const {
    error: gamePriceError,
    isLoading: isGamePriceLoading,
    price: gamePrice,
    retry: retryGamePrice,
  } = useGamePrice({
    enabled: selected?.media_type === 'game',
    isOnline,
    steamAppId,
    title: selected ? getMediaTitle(selected) : '',
  });
  const currentActionPulse = selected && actionPulse?.key === mediaKey ? actionPulse.action : null;
  const railButtonClass = 'absolute inset-y-0 z-10 hidden w-10 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-brand-bg/85 text-brand-cyan backdrop-blur-md transition-colors hover:border-brand-cyan/25 hover:bg-brand-cyan/15 hover:text-white md:flex';

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

  function scrollTrailers(direction: 'left' | 'right') {
    const scroller = trailerScrollerRef.current;
    if (!scroller) return;

    scroller.scrollBy({
      left: direction === 'left' ? -scroller.clientWidth * 0.85 : scroller.clientWidth * 0.85,
      behavior: 'smooth',
    });
  }

  function handleTrailerScroll() {
    const scroller = trailerScrollerRef.current;
    setShowTrailerLeftButton(!!scroller && scroller.scrollLeft > 4);
    setShowTrailerRightButton(!!scroller && scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 4);
  }

  useEffect(() => {
    return () => {
      if (closeActionTimerRef.current) clearTimeout(closeActionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activeImage && !activeTrailer) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      event.stopImmediatePropagation();
      setActiveImage(null);
      setActiveTrailer(null);
    };

    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [activeImage, activeTrailer]);

  useEffect(() => {
    if (castScrollerRef.current) castScrollerRef.current.scrollLeft = 0;
    if (imageScrollerRef.current) imageScrollerRef.current.scrollLeft = 0;
    if (trailerScrollerRef.current) trailerScrollerRef.current.scrollLeft = 0;
    queueMicrotask(() => {
      setShowCastLeftButton(false);
      setShowCastRightButton(false);
      setShowImageLeftButton(false);
      setShowImageRightButton(false);
      setShowTrailerLeftButton(false);
      setShowTrailerRightButton(false);
    });
  }, [mediaKey]);

  useEffect(() => {
    queueMicrotask(handleCastScroll);
  }, [castItems.length, mediaKey]);

  useEffect(() => {
    queueMicrotask(handleImageScroll);
  }, [backdropItems.length, mediaKey, selected?.screenshots?.length]);

  useEffect(() => {
    queueMicrotask(handleTrailerScroll);
  }, [mediaKey, selected?.videos?.length]);

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
  const formattedGamePrice = gamePrice ? formatGamePrice(gamePrice) : '';
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
  const gameTimeItems = isGame
    ? [
        selected.playtime_main ? { label: 'MAIN', value: selected.playtime_main } : null,
        selected.playtime_extra ? { label: 'Main+Sides', value: selected.playtime_extra } : null,
        selected.playtime_completionist ? { label: 'Completionist', value: selected.playtime_completionist } : null,
      ].filter((item): item is { label: string; value: number } => !!item)
    : [];
  const providerLabel = source === 'igdb' ? 'IGDB' : source === 'rawg' ? 'RAWG' : source === 'steam' ? 'Steam' : 'TMDB';
  const posterSrc = getImageSrc(selected.poster_path, (tmdbPath) => getImageUrl(tmdbPath, 'w342'));
  const gameScreenshots = isGame ? (selected.screenshots || []).slice(0, 20) : [];
  const trailerItems = [...(selected.videos || [])]
    .filter((video) => video.site === 'YouTube' && !!video.key)
    .sort((a, b) => {
      const score = (video: Video) => {
        if (video.type === 'Trailer') return 0;
        if (video.type === 'Teaser') return 1;
        if (video.type === 'Clip') return 2;
        return 3;
      };
      const scoreDiff = score(a) - score(b);
      if (scoreDiff !== 0) return scoreDiff;
      if (a.official !== b.official) return a.official ? -1 : 1;
      return (b.published_at || '').localeCompare(a.published_at || '');
    })
    .slice(0, 10);
  const trailerSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} trailer`)}`;
  const showImageSection = isGame
    ? gameScreenshots.length > 0
    : sectionErrors.has(`${mediaKey}:images`) || backdropsKey !== mediaKey || backdropItems.length > 0;
  const externalLinks = [
    trailerItems.length === 0 ? { label: 'Trailer', url: trailerSearchUrl } : null,
    selected.source_url && source !== 'igdb' ? { label: providerLabel, url: selected.source_url } : null,
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
      <div
        ref={imageScrollerRef}
        onScroll={handleImageScroll}
        className="flex snap-x gap-2 overflow-x-auto scroll-smooth pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((image) => (
          <button
            key={image.src}
            type="button"
            onClick={() => setActiveImage({ ...image, mediaKey })}
            className="group w-[31%] shrink-0 snap-start cursor-pointer overflow-hidden rounded-xl bg-white/5 blueprint-border transition-colors duration-200 hover:border-brand-cyan/35 sm:w-[23.5%] md:w-[18.4%]"
          >
            <img
              src={image.src}
              alt={image.alt}
              className="aspect-square w-full object-cover transition-transform duration-200 group-hover:scale-105"
              decoding="async"
              loading="lazy"
            />
          </button>
        ))}
      </div>
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
  const renderTrailerGrid = (items: Video[]) => (
    <div className="relative">
      {showTrailerLeftButton && (
        <button
          type="button"
          onClick={() => scrollTrailers('left')}
          className={`${railButtonClass} left-0`}
          aria-label="Scroll trailers left"
          title="Scroll trailers left"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      <div
        ref={trailerScrollerRef}
        onScroll={handleTrailerScroll}
        className="flex snap-x gap-2 overflow-x-auto scroll-smooth pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((video) => (
          <button
            key={`${video.id}-${video.key}`}
            type="button"
            onClick={() => setActiveTrailer({ video, mediaKey })}
            className="group w-[70%] shrink-0 snap-start cursor-pointer overflow-hidden rounded-xl bg-brand-bg/80 text-left blueprint-border transition-colors duration-200 hover:border-brand-cyan/35 hover:bg-brand-bg sm:w-[46%] md:w-[31%]"
          >
            <div className="relative aspect-video bg-white/5">
              <img
                src={`https://img.youtube.com/vi/${video.key}/hqdefault.jpg`}
                alt=""
                className="h-full w-full object-cover opacity-90 transition-transform duration-200 group-hover:scale-105"
                decoding="async"
                loading="lazy"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/10">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-brand-bg/80 text-brand-cyan backdrop-blur-md transition-colors group-hover:border-brand-cyan/40 group-hover:bg-brand-cyan/20 group-hover:text-white">
                  <Play size={18} fill="currentColor" />
                </span>
              </span>
            </div>
            <div className="p-2">
              <p className="truncate text-xs font-black leading-tight text-white">{video.name || 'Trailer'}</p>
              <p className="type-micro text-brand-silver">{video.type || 'Video'}</p>
            </div>
          </button>
        ))}
      </div>
      {showTrailerRightButton && (
        <button
          type="button"
          onClick={() => scrollTrailers('right')}
          className={`${railButtonClass} right-0`}
          aria-label="Scroll trailers right"
          title="Scroll trailers right"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
  const runAction = async (action: 'watchlist' | 'watched', commit: () => Promise<void> | void) => {
    if (closeActionTimerRef.current) clearTimeout(closeActionTimerRef.current);

    setActionPulse({ key: mediaKey, action });
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
              className="sheet-surface will-change-transform"
            >
              <FocusTrap active={isOpen}>
              <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
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
                      <h2 className="type-display text-white">
                        {title}
                      </h2>
                      {(episodeLabel || movieReleaseLabel) && (
                        <span className="type-label text-brand-cyan">
                          {episodeLabel || movieReleaseLabel}
                        </span>
                      )}
                    </div>

                    <div className="type-readout flex flex-wrap items-center gap-2 text-brand-silver">
                      <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm">{isGame ? 'game' : selected.media_type}</span>
                      {year && <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm">{year}</span>}
                      <span className={clsx('px-2 py-1 rounded-full backdrop-blur-sm', (selected.vote_average ?? 0) >= 7 ? 'bg-brand-cyan/10 text-brand-cyan' : 'bg-white/10 text-brand-silver')}>★ {selected.vote_average?.toFixed(1) || '0.0'}</span>
                      {!isGame && <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm">{contentRatingValue || 'N/A'}</span>}
                      {isGame && selected.metacritic ? <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm">MC {selected.metacritic}</span> : null}
                      {externalLinks.map((link) => (
                        <a
                          key={`${link.label}-${link.url}`}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center rounded-lg bg-white/10 px-2 py-1 text-brand-silver backdrop-blur-sm transition-colors hover:bg-brand-cyan/10 hover:text-brand-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60"
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>

                    <p className="text-sm leading-relaxed text-white/90 line-clamp-6">
                      {selected.overview || 'Overview unavailable.'}
                    </p>
                    {isGamePriceLoading && (
                      <div className="h-[4.25rem] max-w-sm rounded-lg skeleton-shimmer animate-shimmer blueprint-border" aria-label="Loading Steam price" />
                    )}
                    {gamePrice?.lowestCurrent && formattedGamePrice && (
                      <a
                        href={gamePrice.url}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        className="group flex max-w-sm items-center justify-between gap-4 rounded-lg border border-brand-cyan/25 bg-brand-cyan/[0.06] px-3 py-2 transition-colors hover:border-brand-cyan/45 hover:bg-brand-cyan/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60"
                        aria-label={`Lowest Steam price ${formattedGamePrice}; view prices on GG.deals`}
                      >
                        <span>
                          <span className="type-micro block text-brand-silver">Lowest Steam price</span>
                          <span className="type-readout mt-0.5 block text-xl text-white">{formattedGamePrice}</span>
                        </span>
                        <span className="text-right">
                          <span className="type-micro block text-brand-cyan">
                            {gamePrice.lowestCurrent.source === 'keyshop' ? 'Keyshop' : 'Retail'}
                          </span>
                          <span className="type-label mt-1 block text-brand-silver transition-colors group-hover:text-white">GG.deals ↗</span>
                        </span>
                      </a>
                    )}
                    {gamePriceError && (
                      <div className="flex max-w-sm items-center justify-between gap-3 text-xs text-brand-silver">
                        <span>Steam price unavailable.</span>
                        <button
                          type="button"
                          onClick={retryGamePrice}
                          className="min-h-11 rounded-lg px-3 text-brand-cyan transition-colors hover:bg-brand-cyan/10 hover:text-white"
                        >
                          Retry
                        </button>
                      </div>
                    )}
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

                  {initErrorKey === mediaKey && (
                    <div className="flex items-center justify-between rounded-xl bg-red-900/20 border border-red-500/30 p-3">
                      <p className="text-xs font-medium text-red-200">Could not load details. Check your connection and try again.</p>
                      <button
                        type="button"
                        onClick={handleRetryInit}
                        className="type-action min-h-11 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-1 text-red-200 transition-colors hover:border-red-400/60 hover:bg-red-900/60"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-4">
                  {gameTimeItems.length > 0 && (
                    <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-brand-cyan/20 bg-brand-cyan/[0.05]">
                      {gameTimeItems.map((item) => (
                        <div key={item.label} className="border-r border-white/10 px-2 py-2 text-center last:border-r-0">
                          <p className="type-micro truncate text-brand-silver">{item.label}</p>
                          <p className="type-readout mt-1 text-base leading-none text-white sm:text-xl">{item.value}H</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {!isGame && (
                    <>
                    {/* Cast */}
                    <div>
                      {sectionErrors.has(`${mediaKey}:cast`) ? (
                        <div className="flex flex-col items-center gap-3 py-10">
                          <p className="text-sm text-red-200">Failed to load cast.</p>
                          <button
                            type="button"
                            onClick={() => handleRetrySection('cast')}
                            className="type-action min-h-11 rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-1.5 text-red-200 transition-colors hover:border-red-400/60 hover:bg-red-900/60"
                          >
                            Retry
                          </button>
                        </div>
                      ) : castKey !== mediaKey ? (
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
                          <div
                            ref={castScrollerRef}
                            onScroll={handleCastScroll}
                            className="flex snap-x gap-2 overflow-x-auto scroll-smooth pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                          >
                            {castItems.map((member) => (
                              <button
                                key={`${member.id}-${member.character}`}
                                type="button"
                                onClick={() => openActor(member)}
                                className="group w-[31%] shrink-0 snap-start cursor-pointer overflow-hidden rounded-xl bg-brand-bg/80 text-left blueprint-border transition-colors duration-200 hover:border-brand-cyan/30 hover:bg-brand-bg sm:w-[23.5%] md:w-[18.4%]"
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
                              </button>
                            ))}
                          </div>
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
                      <div>
                        {isGame ? (
                          renderImageGrid(gameScreenshots.map((image, index) => ({
                            src: image,
                            alt: `${title} screenshot ${index + 1}`,
                          })))
                        ) : sectionErrors.has(`${mediaKey}:images`) ? (
                          <div className="flex flex-col items-center gap-3 py-10">
                            <p className="text-sm text-red-200">Failed to load images.</p>
                            <button
                              type="button"
                              onClick={() => handleRetrySection('images')}
                              className="type-action min-h-11 rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-1.5 text-red-200 transition-colors hover:border-red-400/60 hover:bg-red-900/60"
                            >
                              Retry
                            </button>
                          </div>
                        ) : backdropsKey !== mediaKey ? (
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

                    {trailerItems.length > 0 && (
                      <div>
                        {renderTrailerGrid(trailerItems)}
                      </div>
                    )}

                <p className="type-readout text-center text-brand-silver/60">
                  Data provided by {providerLabel}.
                </p>
              </div>
              </div>

              <AnimatePresence>
                {activeImage?.mediaKey === mediaKey && (
                  <FocusTrap active>
                  <div
                    className="fixed inset-0 z-[380] flex items-center justify-center p-4"
                    onClick={() => setActiveImage(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Image preview"
                    data-block-details-shortcuts="true"
                  >
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
                        className="max-h-[88vh] max-w-full rounded-xl object-contain blueprint-border"
                        decoding="async"
                      />
                    </motion.div>
                  </div>
                  </FocusTrap>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {activeTrailer?.mediaKey === mediaKey && (
                  <FocusTrap active>
                  <div
                    className="fixed inset-0 z-[380] flex items-center justify-center p-4"
                    onClick={() => setActiveTrailer(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Trailer player"
                    data-block-details-shortcuts="true"
                  >
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
                      className="relative z-10 w-full max-w-5xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveTrailer(null)}
                        className="absolute right-2 top-2 z-20 rounded-lg border border-brand-cyan/25 bg-brand-bg/75 p-3 text-brand-cyan backdrop-blur-md transition-colors hover:bg-brand-cyan/15 hover:text-white"
                        title="Close trailer"
                        aria-label="Close trailer"
                      >
                        <X size={18} />
                      </button>
                      <div className="overflow-hidden rounded-xl bg-brand-bg blueprint-border">
                        <iframe
                          src={`https://www.youtube.com/embed/${activeTrailer.video.key}?autoplay=1&rel=0`}
                          title={activeTrailer.video.name || `${title} trailer`}
                          className="aspect-video w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    </motion.div>
                  </div>
                  </FocusTrap>
                )}
              </AnimatePresence>

              <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/[0.04] bg-brand-bg/75 backdrop-blur-xl px-4 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
                <div className={clsx('grid items-center gap-2', inWatched ? 'grid-cols-[1fr_56px_56px_1fr]' : 'grid-cols-[1fr_56px_1fr]')}>
                  <motion.button
                    type="button"
                    data-details-action="watched"
                    onClick={handleWatchedToggle}
                    title={inWatched ? 'In History' : 'Add to History'}
                    aria-label={inWatched ? 'In History' : 'Add to History'}
                    disabled={!!currentActionPulse}
                    animate={currentActionPulse === 'watched' ? { scale: [1, 1.06, 0.98, 1] } : { scale: 1 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className={clsx(
                      'type-action flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 transition-colors duration-200 disabled:cursor-wait',
                      inWatched
                        ? 'border-green-400/40 bg-green-500/15 text-green-200 hover:border-green-300/60 hover:bg-green-500/25'
                        : 'border-white/15 bg-brand-bg/80 text-white hover:border-brand-cyan/30 hover:bg-brand-cyan/10 hover:text-brand-cyan'
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
                        'flex h-11 w-full cursor-pointer items-center justify-center rounded-lg border transition-colors duration-200 disabled:cursor-wait',
                        isFavorited
                          ? 'border-brand-cyan/40 bg-brand-cyan/15 text-brand-cyan shadow-[0_0_18px_rgba(34,211,238,0.12)] hover:border-brand-cyan/60 hover:bg-brand-cyan/25'
                          : 'border-white/15 bg-brand-bg/80 text-white hover:border-brand-cyan/30 hover:bg-brand-cyan/10 hover:text-brand-cyan'
                      )}
                    >
                      <Heart size={16} className={isFavorited ? 'fill-current' : ''} />
                    </motion.button>
                  )}

                  <button
                    type="button"
                    onClick={closeDetails}
                    className="flex h-11 w-full cursor-pointer items-center justify-center rounded-lg border border-white/10 text-brand-silver transition-colors hover:border-brand-cyan/25 hover:bg-brand-cyan/10 hover:text-white"
                    aria-label="Close sheet"
                    title="Tap to close"
                  >
                    <ChevronDown size={18} />
                  </button>

                  <motion.button
                    type="button"
                    data-details-action="watchlist"
                    onClick={handleWatchlistToggle}
                    title={inWatchlist ? 'In Playlist' : 'Add to Playlist'}
                    aria-label={inWatchlist ? 'In Playlist' : 'Add to Playlist'}
                    disabled={!!currentActionPulse}
                    animate={currentActionPulse === 'watchlist' ? { scale: [1, 1.06, 0.98, 1] } : { scale: 1 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className={clsx(
                      'type-action flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 transition-colors duration-200 disabled:cursor-wait',
                      inWatchlist
                        ? 'border-brand-cyan/40 bg-brand-cyan/15 text-brand-cyan shadow-[0_0_18px_rgba(34,211,238,0.12)] hover:border-brand-cyan/60 hover:bg-brand-cyan/25'
                        : 'border-white/15 bg-brand-bg/80 text-white hover:border-brand-cyan/30 hover:bg-brand-cyan/10 hover:text-brand-cyan'
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
