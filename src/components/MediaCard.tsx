'use client';

import React, { useEffect, useState } from 'react';
import { Media, WatchProvider } from '@/lib/types';
import { getImageUrl, getWatchProviders, getContentRating } from '@/lib/tmdb';
import { checkVidAngelAvailability } from '@/lib/vidangel';
import { useAppContext } from '@/context/AppContext';
import { Plus, Check, Trash2, Play } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

interface MediaCardProps {
  media: Media;
  showActions?: boolean;
}

export const MediaCard: React.FC<MediaCardProps> = ({ media, showActions = true }) => {
  const { apiKey, watchlist, watched, toggleWatchlist, toggleWatched, vidAngelEnabled } = useAppContext();
  
  const [rating, setRating] = useState<string | null>(null);
  const [providers, setProviders] = useState<WatchProvider[]>([]);
  const [vidAngelAvailable, setVidAngelAvailable] = useState(false);
  const [loadingExtras, setLoadingExtras] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (apiKey) {
      // Create a promise for VidAngel check that we can conditionally execute
      const checkVA = async (currentRating: string | null) => {
        if (!vidAngelEnabled || !currentRating) return false;
        
        const isMovie = media.media_type === 'movie';
        const isTV = media.media_type === 'tv';
        const title = media.title || media.name;

        if ((isMovie && currentRating === 'R') || (isTV && currentRating === 'TV-MA')) {
           return checkVidAngelAvailability(title || '', media.id, media.media_type);
        }
        return false;
      };

      Promise.all([
        getContentRating(media.id, media.media_type, apiKey),
        getWatchProviders(media.id, media.media_type, apiKey)
      ]).then(async ([ratingData, providerData]) => {
        if (isMounted) {
          setRating(ratingData);
          
          // Check VidAngel availability based on the fetched rating
          const vaResult = await checkVA(ratingData);
          setVidAngelAvailable(vaResult);

          const usProviders = providerData.results?.['US'];
          const allProviders = [
            ...(usProviders?.flatrate || []),
          ].slice(0, 3); 
          
          const uniqueProviders = allProviders.filter((v, i, a) => a.findIndex(t => t.provider_id === v.provider_id) === i);
          
          setProviders(uniqueProviders);
          setLoadingExtras(false);
        }
      }).catch(() => {
        if (isMounted) setLoadingExtras(false);
      });
    }
    return () => { isMounted = false; };
  }, [media.id, media.media_type, apiKey, vidAngelEnabled, media.title, media.name]);

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

        {vidAngelAvailable && (
           <div className="absolute top-2 left-2 z-10">
             <div className="bg-amber-500 text-white text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded shadow-lg border border-white/30" title="Available on VidAngel">
               Edited
             </div>
           </div>
        )}

        {rating && (
          <div className="absolute bottom-2 left-2">
            <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/20">
              {rating}
            </span>
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

        {/* Streaming Providers */}
        <div className="h-6 mb-3 flex items-center gap-1.5">
          {loadingExtras ? (
            <div className="w-16 h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          ) : providers.length > 0 ? (
            providers.map((p) => (
              <div key={p.provider_id} className="w-6 h-6 rounded-md overflow-hidden border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800" title={p.provider_name}>
                <img src={getImageUrl(p.logo_path, 'w500')} alt={p.provider_name} className="w-full h-full object-cover" />
              </div>
            ))
          ) : (
            <span className="text-[10px] text-gray-300 dark:text-gray-600 italic flex items-center gap-1">
              <Play size={10} /> Stream info unavailable
            </span>
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