'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Media } from '@/lib/types';
import { getImageUrl } from '@/lib/tmdb';
import { checkVidAngelAvailability } from '@/lib/vidangel';
import { useAppContext } from '@/context/AppContext';
import { Plus, Trash2, Star } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
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
    toggleFavorite,
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
  const watchedItem = watched.find((m) => m.id === media.id && m.media_type === media.media_type);
  const inWatched = !!watchedItem;
  const isFavorite = watchedItem?.isFavorite || false;

  const title = media.title || media.name;

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
        }
      });
    } else {
      setModalConfig({
        isOpen: true,
        title: 'Add to Watchlist',
        message: `Add "${title}" to your watchlist?`,
        type: 'info',
        confirmText: 'Add to List',
        onConfirm: () => {
          toggleWatchlist(media);
        }
      });
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
        }
      });
    }
  };

  return (
    <>
      <div ref={cardRef} className="relative group bg-brand-bg rounded-xl overflow-hidden transition-colors duration-300">
        <Link 
          href={`/details?type=${media.media_type}&id=${media.id}`} 
          className="block relative aspect-[2/3] bg-brand-bg/50 overflow-hidden shrink-0 blueprint-border"
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
              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300 rounded-xl shadow-2xl shadow-brand-cyan/10"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-4 text-center text-brand-silver bg-brand-bg/80">
              <span className="text-sm font-medium">{title}</span>
            </div>
          )}
        </Link>
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