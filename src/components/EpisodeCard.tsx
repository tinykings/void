'use client';

import { useState } from 'react';
import type { Episode } from '@/lib/types';
import { getImageUrl } from '@/lib/tmdb';
import { hasEpisodeAired, scrambleSummary } from '@/lib/episodeSpoilers';

const placeholder = `${(process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '')}/episode-placeholder.svg`;

export const EpisodeCard = ({ episode }: { episode: Episode }) => {
  const [revealed, setRevealed] = useState(false);
  const unaired = !hasEpisodeAired(episode.air_date);
  const hidden = unaired && !revealed;
  return (
    <article className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-3 overflow-hidden rounded-xl bg-white/[0.025] p-2 blueprint-border sm:grid-cols-[7rem_minmax(0,1fr)]">
      <div className="aspect-video min-w-0 overflow-hidden rounded-lg bg-white/5">
        <img src={episode.still_path ? getImageUrl(episode.still_path, 'w185') : placeholder} alt=""
          className={`block h-full w-full object-cover ${hidden ? 'scale-110 blur-xl' : ''}`} decoding="async" loading="lazy" />
      </div>
      <div className="flex min-w-0 flex-col py-1 pr-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="type-readout text-brand-cyan">E{String(episode.episode_number).padStart(2, '0')}</p>
          {episode.air_date && <p className="type-readout text-brand-silver">{episode.air_date}</p>}
        </div>
        <h4 className="type-title mt-1 text-white">{episode.name || `Episode ${episode.episode_number}`}</h4>
        {hidden ? <>
          <p aria-hidden="true" className="mt-1 line-clamp-2 sm:line-clamp-3 select-none text-sm leading-relaxed text-brand-silver/40">{scrambleSummary(episode.overview || 'The story continues. This episode summary is hidden until it airs.')}</p>
          <p className="sr-only">Episode summary and image hidden until it airs.</p>
        </> : <p className="mt-1 line-clamp-2 sm:line-clamp-3 text-sm leading-relaxed text-brand-silver">{episode.overview || 'Episode description unavailable.'}</p>}
        {unaired && <button type="button" aria-expanded={revealed} onClick={() => setRevealed((value) => !value)}
          className="type-action mt-1 min-h-11 self-start rounded-lg px-2 text-brand-cyan transition-colors hover:bg-brand-cyan/10 focus-visible:outline-2 focus-visible:outline-brand-cyan">
          {hidden ? 'Reveal spoilers' : 'Hide spoilers'}<span className="sr-only"> for episode {episode.episode_number}</span>
        </button>}
      </div>
    </article>
  );
};
