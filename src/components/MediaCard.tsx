'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Media } from '@/lib/types';
import { getImageUrl } from '@/lib/tmdb';
import { checkVidAngelAvailability } from '@/lib/vidangel';
import { useAppContext } from '@/context/AppContext';
import { Plus, Check, Trash2, Star, Bookmark } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { vidAngelObserver } from '@/lib/observerManager';

interface MediaCardProps {
  media: Media;
  showActions?: boolean;
  showBadge?: boolean;
  onClick?: () => void;
}

export const MediaCard = React.memo(({ media, showActions = true, showBadge = false, onClick }: MediaCardProps) => {
  const { 
    watchlist, 
    watched, 
    toggleWatchlist, 
    toggleWatched, 
    vidAngelEnabled,
    editedStatusMap,
    setMediaEditedStatus
  } = useAppContext();
  
  const cardRef = useRef<HTMLDivElement>(null);
  const isEdited = editedStatusMap[`${media.media_type}-${media.id}`];

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

  const inWatchlist = watchlist.some((m) => m.id === media.id && m.media_type === media.media_type);
  const inWatched = watched.some((m) => m.id === media.id && m.media_type === media.media_type);

  const title = media.title || media.name;
  const year = (media.release_date || media.first_air_date)?.split('-')[0];

  const prefetchBackdrop = () => {
    if (media.backdrop_path) {
      const img = new Image();
      img.src = getImageUrl(media.backdrop_path, 'w780');
    }
  };

  const handleWatchlistClick = () => {
    if (inWatchlist) {
      setModalConfig({
        isOpen: true,
        title: 'Remove from List',
        message: `Are you sure you want to remove "${title}" from your watchlist?`,
        type: 'danger',
        confirmText: 'Remove',
        onConfirm: () => {
          toggleWatchlist(media);
          toast.success('Removed from watchlist');
        }
      });
    } else {
      toggleWatchlist(media);
      toast.success('Added to watchlist');
    }
  };

  const handleWatchedClick = () => {
    if (inWatched) {
      setModalConfig({
        isOpen: true,
        title: 'Remove from History',
        message: `Remove "${title}" from your history?`,
        type: 'danger',
        confirmText: 'Remove',
        onConfirm: () => {
          toggleWatched(media);
          toast.success('Removed from history');
        }
      });
    } else {
      setModalConfig({
        isOpen: true,
        title: 'Mark as Watched',
        message: `Add "${title}" to your watched history?`,
        type: 'info',
        confirmText: 'Mark Watched',
        onConfirm: () => {
          toggleWatched(media);
          toast.success('Marked as watched');
        }
      });
    }
  };

  return (
    <>
      <div ref={cardRef} className="relative group bg-brand-bg blueprint-border rounded-xl overflow-hidden shadow-sm flex flex-col h-full transition-colors duration-300">
        <Link 
          href={`/details?type=${media.media_type}&id=${media.id}`} 
          className="block relative aspect-[2/3] bg-brand-bg/50 overflow-hidden shrink-0"
          onMouseEnter={prefetchBackdrop}
          onTouchStart={prefetchBackdrop}
          onClick={(e) => {
            sessionStorage.setItem('void_home_scroll', String(window.scrollY));
            onClick?.();
          }}
        >
          {media.poster_path ? (
            <img
              src={getImageUrl(media.poster_path)}
              alt={title}
              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-4 text-center text-brand-silver bg-brand-bg/80">
              <span className="text-sm font-medium">{title}</span>
            </div>
          )}

          {showBadge && isEdited && (
            <div className="absolute top-2 left-2 z-10">
              <div className="bg-amber-500/90 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded shadow-lg border border-white/30" title="Available on VidAngel">
                Edited
              </div>
            </div>
          )}
        </Link>

        <div className="p-3 flex flex-col flex-1">
          <div className="mb-2">
            <h3 className="text-sm font-bold truncate leading-tight mb-0.5 text-white" title={title}>{title}</h3>
            <p className="text-[10px] text-brand-silver font-medium uppercase tracking-tighter">
              {media.media_type === 'movie' ? 'Movie' : 'TV'} • {year}
            </p>
            {media.next_episode_to_air && (
              <p className="text-[10px] font-bold text-brand-cyan mt-1 flex items-center gap-1">
                Next: {new Date(media.next_episode_to_air.air_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                <span className="opacity-75 font-normal">
                  (S{media.next_episode_to_air.season_number}E{media.next_episode_to_air.episode_number})
                </span>
              </p>
            )}
          </div>
          
          {showActions && (
            <div className="mt-auto flex gap-1">
              <button
                onClick={handleWatchlistClick}
                className={clsx(
                  "flex-1 py-1.5 rounded-md flex items-center justify-center transition-colors text-[10px] font-bold",
                  inWatchlist 
                    ? "bg-brand-cyan/20 text-brand-cyan blueprint-border" 
                    : "bg-brand-bg/50 text-brand-silver blueprint-border hover:bg-brand-bg hover:text-white"
                )}
              >
                LIST
              </button>
              <button
                onClick={handleWatchedClick}
                className={clsx(
                  "flex-1 py-1.5 rounded-md flex items-center justify-center transition-colors text-[10px] font-bold",
                  inWatched 
                    ? "bg-green-500/20 text-green-400 blueprint-border" 
                    : "bg-brand-bg/50 text-brand-silver blueprint-border hover:bg-brand-bg hover:text-white"
                )}
              >
                {inWatched ? 'WATCHED' : 'WATCH'}
              </button>
            </div>
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
    </>
  );
});

MediaCard.displayName = 'MediaCard';