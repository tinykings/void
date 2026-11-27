import type { Episode } from '@/lib/types';
import { getImageUrl } from '@/lib/tmdb';
import { getEpisodeAirDate } from '@/lib/episodeDates';

const placeholder = `${(process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '')}/episode-placeholder.svg`;

const upcomingDateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const EpisodeCard = ({ episode }: { episode: Episode }) => {
  const number = `E${String(episode.episode_number).padStart(2, '0')}`;
  const airDate = getEpisodeAirDate(episode.air_date);

  if (!airDate?.aired) {
    return (
      <article className="type-readout flex items-baseline justify-between gap-3 rounded-lg bg-white/[0.025] px-3 py-1.5 blueprint-border">
        <span className="text-brand-cyan">{number}</span>
        {airDate ? (
          <time dateTime={episode.air_date ?? undefined} className="text-brand-silver">
            {upcomingDateFormat.format(airDate.date)}
          </time>
        ) : (
          <span className="text-brand-silver">Date TBA</span>
        )}
      </article>
    );
  }

  return (
    <article className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-3 overflow-hidden rounded-xl bg-white/[0.025] p-2 blueprint-border sm:grid-cols-[7rem_minmax(0,1fr)]">
      <div className="aspect-video min-w-0 overflow-hidden rounded-lg bg-white/5">
        <img src={episode.still_path ? getImageUrl(episode.still_path, 'w185') : placeholder} alt=""
          className="block h-full w-full object-cover" decoding="async" loading="lazy" />
      </div>
      <div className="flex min-w-0 flex-col py-1 pr-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="type-readout text-brand-cyan">{number}</span>
          <time dateTime={episode.air_date ?? undefined} className="type-readout text-brand-silver">{episode.air_date}</time>
        </div>
        <h4 className="type-title mt-1 text-white">{episode.name || `Episode ${episode.episode_number}`}</h4>
        <p className="mt-1 line-clamp-2 sm:line-clamp-3 text-sm leading-relaxed text-brand-silver">
          {episode.overview || 'Episode description unavailable.'}
        </p>
      </div>
    </article>
  );
};
