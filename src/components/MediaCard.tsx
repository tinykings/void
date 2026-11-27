'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Media } from '@/lib/types';
import { getImageUrl } from '@/lib/tmdb';
import { UPCOMING_DAYS } from '@/lib/discovery';
import { getPosterIndicator, POSTER_INDICATOR_CLASSES, type PosterIndicatorContext } from '@/lib/posterIndicators';
import { getDetailsHref, getMediaKey, getPosterCandidates } from '@/lib/media';
import { rememberRouteParent, rememberScrollPosition } from '@/lib/clientNavigation';
import { useAppContext } from '@/context/AppContext';
import { clsx } from 'clsx';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Pin } from 'lucide-react';

const DAY_MS = 1000 * 60 * 60 * 24;
const MOVIE_PRIORITY_WINDOW_DAYS = 30;

interface MediaCardProps {
  media: Media;
  showReleaseBadge?: boolean;
  showCaption?: boolean;
  showCaptionDetails?: boolean;
  discoveryCountdown?: number | null;
  indicatorContext?: PosterIndicatorContext;
  onClick?: () => void;
}

interface PosterImageProps {
  candidates: string[];
  title?: string;
  fit?: 'cover' | 'contain';
}

const PosterImage = ({ candidates, title, fit = 'cover' }: PosterImageProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);

  const imageSrc = candidates[imageIndex] || '';

  if (!imageSrc || imageFailed) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4 text-center text-brand-silver bg-brand-bg/80">
        <span className="text-sm font-medium">{title || 'No poster available'}</span>
      </div>
    );
  }

  return (
    <>
      {!imageLoaded && <div className="absolute inset-0 bg-brand-bg/80 animate-pulse" />}
      <img
        src={imageSrc}
        alt={title}
        className={clsx(
          'h-full w-full rounded-xl transition-transform duration-300 group-hover:scale-105',
          fit === 'contain' ? 'object-contain bg-brand-bg' : 'object-cover',
          imageLoaded ? 'opacity-100' : 'opacity-0'
        )}
        loading="lazy"
        decoding="async"
        onLoad={() => setImageLoaded(true)}
        onError={() => {
          if (imageIndex < candidates.length - 1) {
            setImageLoaded(false);
            setImageIndex((index) => index + 1);
            return;
          }

          setImageFailed(true);
        }}
      />
    </>
  );
};

export const MediaCard = React.memo(({ media, showReleaseBadge = true, showCaption = false, showCaptionDetails = true, discoveryCountdown = null, indicatorContext = 'library', onClick }: MediaCardProps) => {
  const router = useRouter();
  const {
    sort,
    watchlistIds,
    watchedIds,
    watchlistMap,
    watchedMap,
    openDetails,
  } = useAppContext();
  
  const cardRef = useRef<HTMLDivElement>(null);

  const imageCandidates = useMemo(() => getPosterCandidates(
    media.poster_path, media.backdrop_path, getImageUrl,
  ), [media.backdrop_path, media.poster_path]);

  const mediaKey = getMediaKey(media);
  const inWatchlist = watchlistIds.has(mediaKey);
  const inWatched = watchedIds.has(mediaKey);
  // Saved state wins over stale search/details snapshots, including explicit unfavorites.
  const libraryItem = watchlistMap.get(mediaKey) ?? watchedMap.get(mediaKey);
  const isFavorite = !!libraryItem?.isFavorite;
  const isPinned = inWatchlist && !!watchlistMap.get(mediaKey)?.pinnedAt;
  const hasDiscoveryCountdown = discoveryCountdown !== null && discoveryCountdown >= 1 && discoveryCountdown <= UPCOMING_DAYS;
  const releaseLabel = hasDiscoveryCountdown ? `Releases in ${discoveryCountdown} ${discoveryCountdown === 1 ? 'day' : 'days'}` : '';
  const posterIndicator = getPosterIndicator({
    context: indicatorContext,
    isPinned,
    isFavorite,
    inPlaylist: inWatchlist,
    inHistory: inWatched,
    isUpcoming: hasDiscoveryCountdown,
  });

  const nowTime = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }, []);

  const daysUntilRelease = (() => {
    const isNextEpisode = media.media_type === 'tv' && !!media.next_episode_to_air;
    const releaseDateStr = (isNextEpisode && media.next_episode_to_air?.air_date) || 
                          media.release_date || 
                          media.first_air_date;
                          
    if (!releaseDateStr) return null;
    
    const releaseDate = new Date(releaseDateStr);
    const diffTime = releaseDate.getTime() - nowTime;
    const diffDays = Math.ceil(diffTime / DAY_MS);
    
    if (media.media_type === 'movie') {
      if (diffDays > MOVIE_PRIORITY_WINDOW_DAYS) return null;

      if (diffDays >= 0) return diffDays;

      if (diffDays >= -MOVIE_PRIORITY_WINDOW_DAYS) return 'now';

      return null;
    }

    if (diffDays > 0) return diffDays;
    
    // For TV shows, if it aired within the last 3 days, show 'now'
    if (isNextEpisode && diffDays >= -3) return 'now';
    
    // For movies/first air dates, if it's today, show 'now'
    if (!isNextEpisode && diffDays === 0) return 'now';

    return null;
  })();

  const shouldShowReleaseBadge = (() => {
    if (!showReleaseBadge) return false;
    if (sort !== 'added') return false;

    return daysUntilRelease !== null;
  })();

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

  const title = media.title || media.name || 'Untitled';
  const year = (media.release_date || media.first_air_date || '').slice(0, 4);
  // Legacy games are retained in storage, never rendered as cards.
  if (media.media_type === 'game') return null;

  return (
    <>
      <div ref={cardRef} className="relative group bg-brand-bg rounded-xl overflow-hidden transition-colors duration-300">
        <button
          type="button"
          className="relative block aspect-[2/3] w-full shrink-0 cursor-pointer overflow-hidden rounded-xl bg-brand-bg/50 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-brand-cyan"
          aria-label={`Open details for ${title}${isPinned ? ', pinned' : ''}${isFavorite ? ', favorite' : ''}${inWatchlist ? ', on playlist' : inWatched ? ', in history' : ''}${releaseLabel ? `, ${releaseLabel.toLowerCase()}` : ''}`}
          onClick={() => {
            openDetails(media);
            onClick?.();

            if (window.matchMedia('(max-width: 767px)').matches) {
              sessionStorage.setItem('void_details_media', JSON.stringify(media));
              const scrollContainer = cardRef.current?.closest<HTMLElement>('[data-route-scroll]');
              rememberScrollPosition(`${location.pathname}${location.search}`, scrollContainer?.scrollTop || window.scrollY);
              rememberRouteParent('/details');
              router.push(getDetailsHref(media));
            }
          }}
        >
          {imageCandidates.length > 0 ? (
            <PosterImage key={imageCandidates.join('|')} candidates={imageCandidates} title={title} />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-4 text-center text-brand-silver bg-brand-bg/80">
              <span className="text-sm font-medium">{title}</span>
            </div>
          )}

          <span
            aria-hidden="true"
            data-poster-indicator={posterIndicator}
            className={clsx('pointer-events-none absolute inset-0 z-20 rounded-xl', POSTER_INDICATOR_CLASSES[posterIndicator])}
          />

          {(hasDiscoveryCountdown || isPinned || (shouldShowReleaseBadge && daysUntilRelease !== null)) && (
            <div className="absolute left-2 top-2 z-10 flex flex-col items-start gap-1.5">
              {isPinned && <span aria-label="Pinned" className="rounded-full bg-brand-bg/90 p-2 text-brand-cyan"><Pin size={14} className="fill-current" /></span>}
              {hasDiscoveryCountdown && <span aria-label={releaseLabel} className="type-micro rounded-full border border-brand-upcoming/40 bg-brand-bg/95 px-2 py-1 text-brand-upcoming backdrop-blur-md">In {discoveryCountdown} {discoveryCountdown === 1 ? 'day' : 'days'}</span>}

              {shouldShowReleaseBadge && daysUntilRelease !== null && (
                <div className="type-micro rounded-full border border-white/10 bg-brand-bg/90 px-2 py-0.5 text-brand-cyan backdrop-blur-md">
                  {daysUntilRelease === 'now' ? 'now' : `${daysUntilRelease} ${daysUntilRelease === 1 ? 'day' : 'days'}`}
                </div>
              )}
            </div>
          )}

          {media.poster_path && (
            <div aria-hidden="true" className="media-card-label pointer-events-none absolute inset-x-0 bottom-0 z-10 translate-y-2 bg-brand-bg/85 px-2.5 py-2 text-left opacity-0 backdrop-blur-md transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <p className="type-action truncate text-white">
                {title}{year && <span className="type-readout text-brand-silver"> · {year}</span>}
              </p>
            </div>
          )}

        </button>

        {showCaption && (
          <div className="min-w-0 px-1 pb-2 pt-2">
            <p className="type-action truncate text-white">{title}</p>
            {showCaptionDetails && <p className="type-readout mt-1 flex items-center gap-1.5 text-brand-silver">
              <span>{year || 'Year unknown'}</span>
              <span aria-hidden="true">·</span>
              <span>{media.media_type === 'tv' ? 'Show' : 'Movie'}</span>
              {inWatched && <span className="ml-auto text-brand-history">History</span>}
              {!inWatched && inWatchlist && <span className="ml-auto text-brand-cyan">Playlist</span>}
            </p>}
          </div>
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
    </>
  );
});

MediaCard.displayName = 'MediaCard';
