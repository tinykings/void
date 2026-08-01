'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Media } from '@/lib/types';
import { getImageUrl } from '@/lib/tmdb';
import { getDetailsHref, getImageSrc, getMediaKey } from '@/lib/media';
import { rememberRouteParent, rememberScrollPosition } from '@/lib/clientNavigation';
import { useAppContext } from '@/context/AppContext';
import { clsx } from 'clsx';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Bookmark, Check, Gamepad2 } from 'lucide-react';

const DAY_MS = 1000 * 60 * 60 * 24;
const MOVIE_PRIORITY_WINDOW_DAYS = 30;

interface MediaCardProps {
  media: Media;
  showReleaseBadge?: boolean;
  showCaption?: boolean;
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

export const MediaCard = React.memo(({ media, showReleaseBadge = true, showCaption = false, onClick }: MediaCardProps) => {
  const router = useRouter();
  const {
    sort,
    isSearchFocused,
    watchlistIds,
    watchedIds,
    openDetails,
  } = useAppContext();
  
  const cardRef = useRef<HTMLDivElement>(null);

  const imageCandidates = useMemo(() => {
    const paths = [media.poster_path, media.backdrop_path].filter((path): path is string => !!path);
    return [...new Set(paths)].map((path) => getImageSrc(path, (tmdbPath) => getImageUrl(tmdbPath)));
  }, [media.backdrop_path, media.poster_path]);

  const mediaKey = getMediaKey(media);
  const inWatchlist = watchlistIds.has(mediaKey);
  const inWatched = watchedIds.has(mediaKey);

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
    
    if (media.media_type === 'movie' || media.media_type === 'game') {
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
  const isGame = media.media_type === 'game';

  return (
    <>
      <div ref={cardRef} className="relative group bg-brand-bg rounded-xl overflow-hidden transition-colors duration-300">
        <button
          type="button"
          className="relative block aspect-[2/3] w-full shrink-0 cursor-pointer overflow-hidden bg-brand-bg/50 blueprint-border"
          aria-label={`Open details for ${title}`}
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

          {shouldShowReleaseBadge && daysUntilRelease !== null && (
            <div className="absolute top-2 left-2 z-10">
              <div className="type-micro rounded-full border border-white/10 bg-brand-bg/90 px-2 py-0.5 text-brand-cyan backdrop-blur-md">
                {daysUntilRelease === 'now' ? 'now' : `${daysUntilRelease} ${daysUntilRelease === 1 ? 'day' : 'days'}`}
              </div>
            </div>
          )}

          {media.poster_path && (
            <div aria-hidden="true" className="media-card-label pointer-events-none absolute inset-x-0 bottom-0 z-10 translate-y-2 bg-brand-bg/85 px-2.5 py-2 text-left opacity-0 backdrop-blur-md transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <p className="type-action truncate text-white">
                {title}{year && <span className="type-readout text-brand-silver"> · {year}</span>}
              </p>
            </div>
          )}

          {isSearchFocused && (isGame || inWatched || inWatchlist) ? (
            <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1.5">
              {isGame && (
                <div className="flex items-center justify-center w-6 h-6 bg-brand-bg/80 backdrop-blur-md text-brand-cyan rounded-full border border-white/10">
                  <Gamepad2 size={13} strokeWidth={2.5} />
                </div>
              )}

              {isSearchFocused && inWatchlist && !inWatched && (
                <div className="flex items-center justify-center w-6 h-6 bg-brand-cyan/65 backdrop-blur-md text-brand-bg rounded-full border border-white/10">
                  <Bookmark size={12} className="fill-current" />
                </div>
              )}

              {isSearchFocused && inWatched && (
                <div className="flex items-center justify-center w-6 h-6 bg-green-500/65 backdrop-blur-md text-brand-bg rounded-full border border-white/10">
                  <Check size={12} strokeWidth={3} />
                </div>
              )}
            </div>
          ) : null}

        </button>

        {showCaption && (
          <div className="min-w-0 px-1 pb-2 pt-2">
            <p className="type-action truncate text-white">{title}</p>
            <p className="type-readout mt-1 flex items-center gap-1.5 text-brand-silver">
              <span>{year || 'Year unknown'}</span>
              <span aria-hidden="true">·</span>
              <span>{isGame ? 'Game' : media.media_type === 'tv' ? 'Show' : 'Movie'}</span>
              {inWatched && <span className="ml-auto text-brand-cyan">History</span>}
              {!inWatched && inWatchlist && <span className="ml-auto text-brand-cyan">Playlist</span>}
            </p>
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
