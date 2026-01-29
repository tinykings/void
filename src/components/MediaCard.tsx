'use client';

import React, { useEffect, useState } from 'react';
import { Media } from '@/lib/types';
import { getImageUrl } from '@/lib/tmdb';
import { checkVidAngelAvailability } from '@/lib/vidangel';
import { useAppContext } from '@/context/AppContext';
import { Plus, Check, Trash2, Star } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

interface MediaCardProps {
  media: Media;
  showActions?: boolean;
  showBadge?: boolean;
}

export const MediaCard: React.FC<MediaCardProps> = ({ media, showActions = true, showBadge = false }) => {
  const { watchlist, watched, toggleWatchlist, toggleWatched } = useAppContext();
  
  const [isEdited, setIsEdited] = useState<boolean>(media.isEdited || false);

  const inWatchlist = watchlist.some((m) => m.id === media.id && m.media_type === media.media_type);
  const inWatched = watched.some((m) => m.id === media.id && m.media_type === media.media_type);

  const title = media.title || media.name;
  const year = (media.release_date || media.first_air_date)?.split('-')[0];

  return (
    <div className="relative group bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col h-full transition-colors duration-300">
      <Link href={`/details?type=${media.media_type}&id=${media.id}`} className="block relative aspect-[2/3] bg-gray-200 dark:bg-gray-800 overflow-hidden shrink-0">
        {media.poster_path ? (
          <img
            src={getImageUrl(media.poster_path)}
            alt={title}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center text-gray-400 bg-gray-100 dark:bg-gray-800">
            <span className="text-sm font-medium">{title}</span>
          </div>
        )}
        
        {/* Overlays */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {inWatched && (
            <div className="bg-green-500 text-white p-1 rounded-full shadow-md">
              <Check size={14} strokeWidth={3} />
            </div>
          )}
          {inWatchlist && (
            <div className="bg-indigo-500 text-white p-1 rounded-full shadow-md">
              <Plus size={14} strokeWidth={3} />
            </div>
          )}
        </div>

        {showBadge && media.isEdited && (
           <div className="absolute top-2 left-2 z-10">
             <div className="bg-amber-500 text-white text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded shadow-lg border border-white/30" title="Available on VidAngel">
               Edited
             </div>
           </div>
        )}
      </Link>

      <div className="p-3 flex flex-col flex-1">
        <div className="mb-2">
          <h3 className="text-sm font-bold truncate leading-tight mb-0.5 text-gray-900 dark:text-gray-100" title={title}>{title}</h3>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-tighter">
            {media.media_type === 'movie' ? 'Movie' : 'TV'} • {year}
          </p>
          {media.next_episode_to_air && (
            <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1">
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
              onClick={() => toggleWatchlist(media)}
              className={clsx(
                "flex-1 py-1.5 rounded-md flex items-center justify-center gap-1 transition-colors text-[10px] font-bold",
                inWatchlist 
                  ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" 
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              )}
            >
              {inWatchlist ? <Trash2 size={12} /> : <Plus size={12} />}
              {inWatchlist ? 'LIST' : 'LIST'}
            </button>
            <button
              onClick={() => toggleWatched(media)}
              className={clsx(
                "flex-1 py-1.5 rounded-md flex items-center justify-center gap-1 transition-colors text-[10px] font-bold",
                inWatched 
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" 
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              )}
            >
              <Check size={12} />
              {inWatched ? 'DONE' : 'WATCHED'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};