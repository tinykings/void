'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { getImageUrl, getSeasonDetails } from '@/lib/tmdb';
import { formatGamePrice, getSteamAppId } from '@/lib/ggDeals';
import { getImageSrc, getMediaKey, getMediaSource, getMediaTitle, getPersonHref } from '@/lib/media';
import { backOrHome, rememberRouteParent } from '@/lib/clientNavigation';
import type { SeasonDetails, Video } from '@/lib/types';
import { ArrowLeft, Bookmark, ChevronDown, Eye, Heart, Play, X } from 'lucide-react';
import { clsx } from 'clsx';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { FocusTrap } from '@/components/FocusTrap';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useMediaDetails } from '@/hooks/useMediaDetails';
import { useDetailsSupplementaryData } from '@/hooks/useDetailsSupplementaryData';
import { useGamePrice } from '@/hooks/useGamePrice';

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const episodePlaceholderSrc = `${basePath}/episode-placeholder.svg`;

export const DetailsSheet = () => {
  const isOnline = useOnlineStatus();
  const pathname = usePathname();
  const router = useRouter();
  const isPageMode = pathname.replace(/\/$/, '').endsWith('/details');
  const {
    activeDetailsMedia,
    closeDetails,
    apiKey,
    watchlistIds,
    watchedIds,
    watchlistMap,
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
  const [overviewExpansion, setOverviewExpansion] = useState<{ key: string; expanded: boolean }>({ key: '', expanded: false });
  const [actionPulse, setActionPulse] = useState<{ key: string; action: 'watchlist' | 'watched' | 'favorite' } | null>(null);
  const [seasonSelection, setSeasonSelection] = useState<{ mediaKey: string; number: number } | null>(null);
  const [seasonData, setSeasonData] = useState<{ key: string; data: SeasonDetails } | null>(null);
  const [seasonErrorKey, setSeasonErrorKey] = useState<string | null>(null);
  const [seasonRetryCount, setSeasonRetryCount] = useState(0);
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
  const title = selected ? getMediaTitle(selected) : 'Details';
  const isOverviewExpanded = overviewExpansion.key === mediaKey && overviewExpansion.expanded;
  const availableSeasons = useMemo(
    () => selected?.media_type === 'tv'
      ? [...(selected.seasons || [])]
          .filter((season) => season.season_number > 0 && season.episode_count > 0)
          .sort((a, b) => b.season_number - a.season_number)
      : [],
    [selected],
  );
  const latestSeasonNumber = availableSeasons[0]?.season_number ?? null;
  const selectedSeasonNumber = seasonSelection?.mediaKey === mediaKey
    ? seasonSelection.number
    : latestSeasonNumber;

  const inWatchlist = mediaKey ? watchlistIds.has(mediaKey) : false;
  const inWatched = mediaKey ? watchedIds.has(mediaKey) : false;
  const isFavorited = selected
    ? watchedMap.get(mediaKey)?.isFavorite ?? watchlistMap.get(mediaKey)?.isFavorite ?? false
    : false;
  const showFavoriteButton = inWatched || (inWatchlist && isFavorited);
  const {
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
    if (!selected || selected.media_type !== 'tv' || selectedSeasonNumber === null || !apiKey || !isOnline) return;

    const requestKey = `${mediaKey}:${selectedSeasonNumber}:${seasonRetryCount}`;
    if (seasonData?.key === requestKey) return;

    const controller = new AbortController();
    void getSeasonDetails(selected.id, selectedSeasonNumber, apiKey, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setSeasonData({ key: requestKey, data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setSeasonErrorKey(requestKey);
      });

    return () => controller.abort();
  }, [apiKey, isOnline, mediaKey, seasonData?.key, seasonRetryCount, selected, selectedSeasonNumber]);

  useEffect(() => {
    if (!isPageMode || !activeDetailsMedia) return;
    const previousTitle = document.title;
    document.title = `${title} — Void`;
    return () => { document.title = previousTitle; };
  }, [activeDetailsMedia, isPageMode, title]);

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
  const totalSeasons = selected.media_type === 'tv'
    ? selected.number_of_seasons ?? availableSeasons.length
    : 0;
  const totalEpisodes = selected.media_type === 'tv'
    ? selected.number_of_episodes ?? availableSeasons.reduce((total, season) => total + season.episode_count, 0)
    : 0;
  const gameTimeItems = isGame
    ? [
        selected.playtime_main ? { label: 'MAIN', value: selected.playtime_main } : null,
        selected.playtime_extra ? { label: 'Main+Sides', value: selected.playtime_extra } : null,
        selected.playtime_completionist ? { label: 'Completionist', value: selected.playtime_completionist } : null,
      ].filter((item): item is { label: string; value: number } => !!item)
    : [];
  const providerLabel = source === 'igdb' ? 'IGDB' : source === 'rawg' ? 'RAWG' : source === 'steam' ? 'Steam' : 'TMDB';
  const posterSrc = getImageSrc(selected.poster_path, (tmdbPath) => getImageUrl(tmdbPath, 'w342'));
  const detailImages = (selected.screenshots || []).slice(0, 3);
  const detailTrailers = (selected.videos || [])
    .filter((video) => video.site === 'YouTube' && !!video.key)
    .slice(0, 3);
  const seasonRequestKey = selectedSeasonNumber === null ? '' : `${mediaKey}:${selectedSeasonNumber}:${seasonRetryCount}`;
  const currentSeason = seasonData?.key === seasonRequestKey ? seasonData.data : null;
  const isSeasonLoading = selected.media_type === 'tv'
    && selectedSeasonNumber !== null
    && isOnline
    && !!apiKey
    && !currentSeason
    && seasonErrorKey !== seasonRequestKey;
  const externalLinks = [
    selected.source_url && source !== 'igdb' ? { label: providerLabel, url: selected.source_url } : null,
  ].filter((link): link is { label: string; url: string } => !!link && !!link.url);  const runAction = async (action: 'watchlist' | 'watched' | 'favorite', commit: () => Promise<void> | void) => {
    if (closeActionTimerRef.current) clearTimeout(closeActionTimerRef.current);

    setActionPulse({ key: mediaKey, action });
    await Promise.resolve(commit());

    closeActionTimerRef.current = setTimeout(() => {
      setActionPulse(null);
    }, 400);
  };

  const handleClose = () => {
    closeDetails();
    if (isPageMode) backOrHome(router, '/details');
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

  const handleOpenActor = (member: typeof castItems[number]) => {
    openActor(member);
    if (isPageMode && window.matchMedia('(max-width: 767px)').matches) {
      sessionStorage.setItem('void_person', JSON.stringify(member));
      rememberRouteParent('/person');
      router.push(getPersonHref(member));
    }
  };

  const handleFavoriteToggle = () => {
    if (!showFavoriteButton) return;
    void runAction('favorite', () => toggleFavorite(selected));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className={`fixed inset-0 z-[350] flex justify-center ${isPageMode ? 'items-stretch' : 'items-end'}`} onClick={isPageMode ? undefined : closeAllSheets}>
            {!isPageMode && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              />
            )}

            <motion.div
              initial={isPageMode ? false : { y: '100%' }}
              animate={{ y: 0 }}
              exit={isPageMode ? undefined : { y: '100%' }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className={`${isPageMode ? 'page-surface' : 'sheet-surface'} will-change-transform`}
            >
              <FocusTrap active={isOpen && !isPageMode}>
              <button
                type="button"
                onClick={handleClose}
                className={clsx(
                  'absolute right-4 z-30 rounded-lg border border-white/10 bg-brand-bg/80 p-3 text-brand-silver backdrop-blur-md transition-colors hover:border-brand-cyan/25 hover:bg-brand-cyan/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60',
                  isPageMode ? 'top-[calc(env(safe-area-inset-top,0px)+0.75rem)]' : 'top-3',
                )}
                aria-label={isPageMode ? 'Back to collection' : 'Close details'}
                title={isPageMode ? 'Back to collection' : 'Close details'}
              >
                {isPageMode ? <ArrowLeft size={20} /> : <X size={20} />}
              </button>
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
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pr-12">
                      {isPageMode ? (
                        <h1 className="type-display text-white">{title}</h1>
                      ) : (
                        <h2 className="type-display text-white">{title}</h2>
                      )}
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
                      {!isGame && selected.genres && selected.genres.length > 0 && (
                        <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm">
                          {selected.genres.slice(0, 3).join(' · ')}
                        </span>
                      )}
                      {!isGame && selected.status && (
                        <span className={clsx(
                          'px-2 py-1 rounded-full backdrop-blur-sm',
                          /cancel/i.test(selected.status)
                            ? 'bg-red-500/10 text-red-200'
                            : /production|returning/i.test(selected.status)
                              ? 'bg-brand-cyan/10 text-brand-cyan'
                              : 'bg-white/10 text-brand-silver'
                        )}>
                          {selected.status}
                        </span>
                      )}
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

                    <div>
                      <p className={clsx('text-sm leading-relaxed text-white/90', !isOverviewExpanded && 'line-clamp-6')}>
                        {selected.overview || 'Overview unavailable.'}
                      </p>
                      {(selected.overview?.length || 0) > 320 && (
                        <button
                          type="button"
                          onClick={() => setOverviewExpansion({ key: mediaKey, expanded: !isOverviewExpanded })}
                          className="type-action mt-2 min-h-11 text-brand-cyan hover:text-white"
                          aria-expanded={isOverviewExpanded}
                        >
                          {isOverviewExpanded ? 'Less' : 'More'}
                        </button>
                      )}
                    </div>
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
                    {watchProviderItems.length > 0 && (
                      <p className="text-base font-semibold leading-relaxed text-white/90">
                        {watchProviderItems.map((p) => p.provider_name).join(' · ')}
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

              {isPageMode && (
                <nav className="sticky top-0 z-20 -mx-4 mb-4 hidden gap-1 overflow-x-auto border-y border-white/10 bg-brand-bg/90 px-4 py-2 backdrop-blur-xl md:flex" aria-label="Details sections">
                  <a href="#overview" className="type-action flex min-h-11 shrink-0 items-center rounded-lg px-3 text-brand-silver hover:bg-white/5 hover:text-white">Overview</a>
                  {(detailTrailers.length > 0 || detailImages.length > 0) && <a href="#media" className="type-action flex min-h-11 shrink-0 items-center rounded-lg px-3 text-brand-silver hover:bg-white/5 hover:text-white">Media</a>}
                  {selected.media_type === 'tv' && <a href="#episodes" className="type-action flex min-h-11 shrink-0 items-center rounded-lg px-3 text-brand-silver hover:bg-white/5 hover:text-white">Episodes</a>}
                  {!isGame && <a href="#cast" className="type-action flex min-h-11 shrink-0 items-center rounded-lg px-3 text-brand-silver hover:bg-white/5 hover:text-white">Cast</a>}
                </nav>
              )}

              <span id="overview" className="sr-only">Overview</span>

              {isGame && (gameTimeItems.length > 0 || isGamePriceLoading || (gamePrice?.lowestCurrent && formattedGamePrice) || gamePriceError) && (
                <section aria-labelledby="game-metrics-heading" className="space-y-3 border-t border-white/10 pt-4">
                  <h3 id="game-metrics-heading" className="type-label text-brand-silver">
                    {gamePrice?.lowestCurrent && formattedGamePrice ? 'HLTB + Deals' : 'HLTB'}
                  </h3>
                  <div className={clsx(
                    'grid items-stretch gap-2',
                    (isGamePriceLoading || (gamePrice?.lowestCurrent && formattedGamePrice) || gamePriceError) && 'sm:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)]'
                  )}>
                    {gameTimeItems.length > 0 && (
                      <div className={clsx(
                        'grid min-h-[5rem] w-full overflow-hidden rounded-lg border border-brand-cyan/20 bg-brand-cyan/[0.05]',
                        gameTimeItems.length === 1 && 'grid-cols-1',
                        gameTimeItems.length === 2 && 'grid-cols-2',
                        gameTimeItems.length === 3 && 'grid-cols-3',
                      )}>
                        {gameTimeItems.map((item) => (
                          <div key={item.label} className="flex min-w-0 flex-col justify-center border-r border-white/10 px-2 py-3 text-center last:border-r-0">
                            <p className="type-label truncate text-brand-silver">{item.label}</p>
                            <p className="type-readout mt-1 text-xl leading-none text-white sm:text-2xl">{item.value}H</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {isGamePriceLoading && (
                      <div className="min-h-[5rem] rounded-lg skeleton-shimmer animate-shimmer blueprint-border" aria-label="Loading Steam price" />
                    )}
                    {gamePrice?.lowestCurrent && formattedGamePrice && (
                      <a
                        href={gamePrice.url}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        className="group flex min-h-[5rem] items-center justify-between gap-3 rounded-lg border border-brand-cyan/25 bg-brand-cyan/[0.06] px-4 py-3 transition-colors hover:border-brand-cyan/45 hover:bg-brand-cyan/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60"
                        aria-label={`${gamePrice.lowestCurrent.source === 'keyshop' ? 'Keyshop' : 'Retail'} price ${formattedGamePrice}; view prices on GG.deals`}
                      >
                        <span>
                          <span className="type-label block text-brand-cyan">
                            {gamePrice.lowestCurrent.source === 'keyshop' ? 'Keyshop' : 'Retail'}
                          </span>
                          <span className="type-readout mt-1 block text-2xl text-white">{formattedGamePrice}</span>
                        </span>
                        <span className="type-label text-right text-brand-silver transition-colors group-hover:text-white">GG.deals ↗</span>
                      </a>
                    )}
                    {gamePriceError && (
                      <div className="flex min-h-[5rem] items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-4 text-xs text-brand-silver">
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
                  </div>
                </section>
              )}

              {(detailTrailers.length > 0 || detailImages.length > 0) && (
                <div id="media" className="scroll-mt-16 space-y-4 border-t border-white/10 pt-4">
                  {detailTrailers.length > 0 && (
                    <div>
                      <p className="type-label mb-2 text-brand-silver">Trailers</p>
                      <div className="grid grid-cols-1 gap-2 xs:grid-cols-3">
                        {detailTrailers.map((video) => (
                          <button
                            key={`${video.id}-${video.key}`}
                            type="button"
                            onClick={() => setActiveTrailer({ video, mediaKey })}
                            className="group cursor-pointer overflow-hidden rounded-lg bg-white/5 blueprint-border transition-colors hover:border-brand-cyan/35"
                            aria-label={`Play ${video.name || 'trailer'}`}
                          >
                            <span className="relative block aspect-video overflow-hidden">
                              <img
                                src={`https://img.youtube.com/vi/${video.key}/hqdefault.jpg`}
                                alt=""
                                className="h-full w-full object-cover opacity-90 transition-transform group-hover:scale-105"
                                decoding="async"
                                loading="lazy"
                              />
                              <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-bg/80 text-brand-cyan backdrop-blur-md">
                                  <Play size={14} fill="currentColor" />
                                </span>
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailImages.length > 0 && (
                    <div>
                      <p className="type-label mb-2 text-brand-silver">Images</p>
                      <div className="grid grid-cols-1 gap-2 xs:grid-cols-3">
                        {detailImages.map((image, index) => {
                          const imageSrc = getImageSrc(image, (tmdbPath) => getImageUrl(tmdbPath, 'w780'));
                          const fullImageSrc = getImageSrc(image, (tmdbPath) => getImageUrl(tmdbPath, 'original'));
                          return (
                            <button
                              key={image}
                              type="button"
                              onClick={() => setActiveImage({ src: fullImageSrc, alt: `${title} image ${index + 1}`, mediaKey })}
                              className="group cursor-pointer overflow-hidden rounded-lg bg-white/5 blueprint-border transition-colors hover:border-brand-cyan/35"
                            >
                              <img
                                src={imageSrc}
                                alt={`${title} image ${index + 1}`}
                                className="aspect-video h-full w-full object-cover transition-transform group-hover:scale-105"
                                decoding="async"
                                loading="lazy"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 space-y-4">
                  {!isGame && (
                    <>
                    {selected.media_type === 'tv' && (
                      <section id="episodes" aria-labelledby="episodes-heading" className="scroll-mt-16 space-y-3 border-t border-white/10 pt-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 id="episodes-heading" className="type-label text-brand-silver">
                            {totalSeasons > 0 || totalEpisodes > 0
                              ? `${totalSeasons} ${totalSeasons === 1 ? 'season' : 'seasons'} - ${totalEpisodes} ${totalEpisodes === 1 ? 'episode' : 'episodes'}`
                              : 'Episodes'}
                          </h3>
                          {availableSeasons.length > 0 && (
                            <label className="relative">
                              <span className="sr-only">Select season</span>
                              <select
                                value={selectedSeasonNumber ?? ''}
                                onChange={(event) => setSeasonSelection({ mediaKey, number: Number(event.target.value) })}
                                className="type-readout min-h-11 appearance-none rounded-lg border border-white/15 bg-brand-bg py-2 pl-3 pr-9 text-white outline-none transition-colors hover:border-brand-cyan/35 focus-visible:ring-2 focus-visible:ring-brand-cyan/60"
                              >
                                {availableSeasons.map((season) => (
                                  <option key={season.id} value={season.season_number}>
                                    {season.name || `Season ${season.season_number}`} · {season.episode_count}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-cyan" />
                            </label>
                          )}
                        </div>

                        {isSeasonLoading ? (
                          <div className="space-y-2" aria-label="Loading episodes">
                            {[0, 1, 2].map((item) => (
                              <div key={item} className="grid grid-cols-[7.5rem_1fr] gap-3 overflow-hidden rounded-xl blueprint-border sm:grid-cols-[11rem_1fr]">
                                <div className="aspect-video skeleton-shimmer animate-shimmer" />
                                <div className="space-y-2 py-3 pr-3">
                                  <div className="h-3 w-24 rounded skeleton-shimmer animate-shimmer" />
                                  <div className="h-3 w-full rounded skeleton-shimmer animate-shimmer" />
                                  <div className="h-3 w-3/4 rounded skeleton-shimmer animate-shimmer" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : seasonErrorKey === seasonRequestKey ? (
                          <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-900/20 p-3">
                            <p className="text-sm text-red-200">Failed to load episodes.</p>
                            <button
                              type="button"
                              onClick={() => setSeasonRetryCount((count) => count + 1)}
                              className="type-action min-h-11 rounded-lg border border-red-500/40 bg-red-950/40 px-4 text-red-200 transition-colors hover:bg-red-900/60"
                            >
                              Retry
                            </button>
                          </div>
                        ) : currentSeason?.episodes.length ? (
                          <div className="space-y-2">
                            {currentSeason.episodes.map((episode) => (
                              <article key={episode.id} className="grid overflow-hidden rounded-xl bg-white/[0.025] blueprint-border sm:grid-cols-[13rem_1fr]">
                                <div className="aspect-video min-w-0 overflow-hidden bg-white/5 sm:aspect-auto sm:h-full sm:min-h-32">
                                  <img
                                    src={episode.still_path ? getImageUrl(episode.still_path, 'w500') : episodePlaceholderSrc}
                                    alt=""
                                    className="block h-full w-full object-cover"
                                    decoding="async"
                                    loading="lazy"
                                  />
                                </div>
                                <div className="flex min-w-0 flex-col justify-center p-3 sm:p-4">
                                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                    <p className="type-readout text-brand-cyan">E{String(episode.episode_number).padStart(2, '0')}</p>
                                    {episode.air_date && <p className="type-readout text-brand-silver">{episode.air_date}</p>}
                                  </div>
                                  <h4 className="type-title mt-1 text-white">{episode.name || `Episode ${episode.episode_number}`}</h4>
                                  <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-brand-silver">
                                    {episode.overview || 'Episode description unavailable.'}
                                  </p>
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-brand-silver">
                            Episode information unavailable.
                          </p>
                        )}
                      </section>
                    )}

                    {/* Cast */}
                    <section id="cast" aria-labelledby="cast-heading" className="scroll-mt-16 space-y-3 border-t border-white/10 pt-4">
                      <h3 id="cast-heading" className="type-label text-brand-silver">Cast</h3>
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
                        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
                          {[...Array(6)].map((_, index) => (
                            <div key={index} className="aspect-square rounded-xl skeleton-shimmer animate-shimmer" />
                          ))}
                        </div>
                      ) : castItems.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
                          {castItems.map((member) => (
                            <button
                              key={`${member.id}-${member.character}`}
                              type="button"
                              onClick={() => handleOpenActor(member)}
                              className="group min-w-0 cursor-pointer overflow-hidden rounded-xl bg-brand-bg/80 text-left blueprint-border transition-colors duration-200 hover:border-brand-cyan/30 hover:bg-brand-bg"
                            >
                              <div className="aspect-square bg-white/5">
                                {member.profile_path ? (
                                  <img src={getImageUrl(member.profile_path, 'w185')} alt={member.name} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" decoding="async" loading="eager" />
                                ) : null}
                              </div>
                              <div className="p-2">
                                <p className="break-words text-xs font-black leading-tight text-white">{member.name}</p>
                                <p className="truncate text-[10px] text-brand-silver">{member.character}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="py-10 text-center text-sm text-brand-silver">Cast unavailable.</p>
                      )}
                    </section>
                    </>
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
                      className="fixed inset-0 z-[380] flex cursor-pointer items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
                      onClick={() => setActiveImage(null)}
                      role="dialog"
                      aria-modal="true"
                      aria-label="Image preview"
                      data-block-details-shortcuts="true"
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className="relative flex max-h-[96vh] max-w-[96vw] cursor-default items-center justify-center"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveImage(null)}
                          className="absolute right-2 top-2 z-20 cursor-pointer rounded-lg bg-brand-bg/80 p-3 text-brand-cyan backdrop-blur-md"
                          aria-label="Close image"
                        >
                          <X size={18} />
                        </button>
                        <img
                          src={activeImage.src}
                          alt={activeImage.alt}
                          className="max-h-[94vh] max-w-[96vw] rounded-xl object-contain blueprint-border"
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
                      className="fixed inset-0 z-[380] flex cursor-pointer items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
                      onClick={() => setActiveTrailer(null)}
                      role="dialog"
                      aria-modal="true"
                      aria-label="Trailer player"
                      data-block-details-shortcuts="true"
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className="relative w-full max-w-5xl cursor-default overflow-hidden rounded-xl bg-brand-bg blueprint-border"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveTrailer(null)}
                          className="absolute right-2 top-2 z-20 cursor-pointer rounded-lg bg-brand-bg/80 p-3 text-brand-cyan backdrop-blur-md"
                          aria-label="Close trailer"
                        >
                          <X size={18} />
                        </button>
                        <iframe
                          src={`https://www.youtube.com/embed/${activeTrailer.video.key}?autoplay=1&rel=0`}
                          title={activeTrailer.video.name || `${title} trailer`}
                          className="aspect-video w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </motion.div>
                    </div>
                  </FocusTrap>
                )}
              </AnimatePresence>

              <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/[0.04] bg-brand-bg/75 py-3 pl-[calc(env(safe-area-inset-left,0px)+1rem)] pr-[calc(env(safe-area-inset-right,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] backdrop-blur-xl">
                <div className={clsx(
                  'grid items-center gap-2',
                  isPageMode
                    ? showFavoriteButton ? 'grid-cols-[1fr_56px_1fr]' : 'grid-cols-2'
                    : showFavoriteButton ? 'grid-cols-[1fr_56px_56px_1fr]' : 'grid-cols-[1fr_56px_1fr]'
                )}>
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
                    {inWatched ? 'In history' : 'Add to history'}
                  </motion.button>

                  {showFavoriteButton && (
                    <motion.button
                      type="button"
                      onClick={handleFavoriteToggle}
                      title={isFavorited ? 'Remove favorite' : 'Mark favorite'}
                      aria-label={isFavorited ? 'Remove favorite' : 'Mark favorite'}
                      disabled={!!currentActionPulse}
                      animate={currentActionPulse === 'favorite' ? { scale: [1, 1.06, 0.98, 1] } : { scale: 1 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className={clsx(
                        'flex h-11 w-full cursor-pointer items-center justify-center rounded-lg border transition-colors duration-200 disabled:cursor-wait',
                        isFavorited
                          ? 'border-rose-400/45 bg-rose-500/15 text-rose-300 shadow-[0_0_18px_rgba(251,113,133,0.14)] hover:border-rose-300/60 hover:bg-rose-500/25'
                          : 'border-rose-400/25 bg-rose-500/[0.06] text-rose-300 hover:border-rose-300/50 hover:bg-rose-500/15'
                      )}
                    >
                      <Heart size={16} className={isFavorited ? 'fill-current' : ''} />
                    </motion.button>
                  )}

                  {!isPageMode && (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex h-11 w-full cursor-pointer items-center justify-center rounded-lg border border-white/10 text-brand-silver transition-colors hover:border-brand-cyan/25 hover:bg-brand-cyan/10 hover:text-white"
                    aria-label="Close sheet"
                    title="Tap to close"
                  >
                    <ChevronDown size={18} />
                  </button>
                  )}

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
                    {inWatchlist ? 'In playlist' : 'Add to playlist'}
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
