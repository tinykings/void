'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Media } from '@/lib/types';
import { getImageUrl } from '@/lib/tmdb';
import { checkVidAngelAvailability } from '@/lib/vidangel';
import { useAppContext } from '@/context/AppContext';
import { clsx } from 'clsx';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { vidAngelObserver } from '@/lib/observerManager';

interface MediaCardProps {
  media: Media;
  showBadge?: boolean;
  onClick?: () => void;
}

export const MediaCard = React.memo(({ media, showBadge = false, onClick }: MediaCardProps) => {
  const {
    vidAngelEnabled,
    editedStatusMap,
    setMediaEditedStatus,
    sort,
    isSearchFocused,
    watchlistIds,
    watchedIds,
    openDetails,
  } = useAppContext();
  
  const cardRef = useRef<HTMLDivElement>(null);
  const isEdited = editedStatusMap[`${media.media_type}-${media.id}`];
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const mediaKey = `${media.media_type}-${media.id}`;
  const inWatchlist = watchlistIds.has(mediaKey);
  const inWatched = watchedIds.has(mediaKey);

  const daysUntilRelease = useMemo(() => {
    if (sort !== 'release') return null;
    
    const isNextEpisode = media.media_type === 'tv' && !!media.next_episode_to_air;
    const releaseDateStr = (isNextEpisode && media.next_episode_to_air?.air_date) || 
                          media.release_date || 
                          media.first_air_date;
                          
    if (!releaseDateStr) return null;
    
    const releaseDate = new Date(releaseDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = releaseDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) return diffDays;
    
    // For TV shows, if it aired within the last 3 days, show 'now'
    if (isNextEpisode && diffDays >= -3) return 'now';
    
    // For movies/first air dates, if it's today, show 'now'
    if (!isNextEpisode && diffDays === 0) return 'now';
    
    return null;
  }, [sort, media.release_date, media.first_air_date, media.next_episode_to_air, media.media_type]);

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
    // Only check if VidAngel is enabled, we don't have a status yet, AND the Edited filter is active
    if (!vidAngelEnabled || !showBadge || isEdited !== undefined || !cardRef.current) return;

    const element = cardRef.current;
    
    vidAngelObserver.observe(element, () => {
      checkVidAngelAvailability(media.title || media.name || '', media.id)
        .then((slug) => {
          setMediaEditedStatus(media.id, media.media_type, !!slug);
        });
    });

    return () => vidAngelObserver.unobserve(element);
  }, [media.id, media.media_type, media.title, media.name, vidAngelEnabled, isEdited, setMediaEditedStatus, showBadge]);

  const title = media.title || media.name;

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
  }, [media.poster_path, media.id, media.media_type]);

  return (
    <>
      <div ref={cardRef} className="relative group bg-brand-bg rounded-xl overflow-hidden transition-colors duration-300">
        <button
          type="button"
          className="block relative aspect-[2/3] bg-brand-bg/50 overflow-hidden shrink-0 blueprint-border"
          onClick={() => {
            openDetails(media);
            onClick?.();
          }}
        >
          {media.poster_path && !imageFailed ? (
            <>
              {!imageLoaded && <div className="absolute inset-0 bg-brand-bg/80 animate-pulse" />}
              <img
                src={getImageUrl(media.poster_path)}
                alt={title}
                className={clsx(
                  'object-cover w-full h-full group-hover:scale-105 transition-all duration-300 rounded-xl shadow-2xl shadow-brand-cyan/10',
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                )}
                loading="lazy"
                decoding="async"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageFailed(true)}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center p-4 text-center text-brand-silver bg-brand-bg/80">
              <span className="text-sm font-medium">{title}</span>
            </div>
          )}

          {daysUntilRelease !== null && (
            <div className="absolute top-2 left-2 z-10">
              <div className="bg-brand-bg/60 backdrop-blur-md text-brand-cyan text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded shadow-lg border border-brand-cyan/30">
                {daysUntilRelease === 'now' ? 'now' : `${daysUntilRelease} ${daysUntilRelease === 1 ? 'day' : 'days'}`}
              </div>
            </div>
          )}

          {isSearchFocused && (inWatched || inWatchlist) && (
            <div className="absolute top-2 right-2 z-10">
              <div className={clsx(
                "backdrop-blur-md text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded shadow-lg border",
                inWatched 
                  ? "bg-green-500/20 text-green-400 border-green-500/30" 
                  : "bg-brand-cyan/20 text-brand-cyan border-brand-cyan/30"
              )}>
                {inWatched ? 'Watched' : 'Watchlist'}
              </div>
            </div>
          )}
        </button>
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
