import Image from 'next/image';
import { Film } from 'lucide-react';
import { getImageUrl } from '@/lib/tmdb';
import { getImageSrc, getMediaKey } from '@/lib/media';
import type { Media } from '@/lib/types';
import type { StreamProviderGroup } from '@/lib/streamProviders';

const getMediaTitle = (media: Media) => media.title || media.name || 'Unknown title';
const getPosterUrl = (media: Media) => {
  const path = media.poster_path || media.backdrop_path;
  return path ? getImageSrc(path, (tmdbPath) => getImageUrl(tmdbPath, 'w185')) : '';
};

type HomeStreamSectionProps = {
  emptyDescription: string;
  emptyTitle: string;
  failureCount: number;
  groups: StreamProviderGroup[];
  isLoading: boolean;
  onSelect: (media: Media) => void;
  playlistCount: number;
};

export const HomeStreamSection = ({
  emptyDescription,
  emptyTitle,
  failureCount,
  groups,
  isLoading,
  onSelect,
  playlistCount,
}: HomeStreamSectionProps) => (
  <div className="mx-auto max-w-3xl space-y-3">
    <div className="flex items-start justify-between gap-4 px-1">
      <div className="min-w-0">
        <h1 className="type-display text-white">Stream</h1>
        <p className="mt-1 text-xs font-medium text-brand-silver">
          US free and subscription providers for your playlist. Data provided by JustWatch.
        </p>
      </div>
      <div className="type-readout rounded-full border border-brand-cyan/20 bg-brand-cyan/10 px-3 py-1 text-brand-cyan">
        {playlistCount}
      </div>
    </div>

    {isLoading ? (
      <div className="space-y-2 pt-3">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-xl blueprint-border bg-white/[0.03]" />
        ))}
      </div>
    ) : groups.length > 0 ? (
      <div className="space-y-4 pt-2">
        {failureCount > 0 && (
          <p className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs font-medium text-amber-100">
            {failureCount} {failureCount === 1 ? 'title could' : 'titles could'} not be checked.
          </p>
        )}
        {groups.map((group) => (
          <section key={group.provider.provider_id} className="overflow-hidden rounded-xl blueprint-border bg-white/[0.03]">
            <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
              <h2 className="type-title min-w-0 truncate text-white">
                {group.provider.provider_name}
              </h2>
              <span className="type-readout shrink-0 rounded-full bg-brand-cyan/10 px-2.5 py-1 text-brand-cyan">
                {group.items.length}
              </span>
            </div>
            <div className="divide-y divide-white/5">
              {group.items.map(({ media, contentRating }) => {
                const posterUrl = getPosterUrl(media);
                return (
                  <button
                    key={`${group.provider.provider_id}-${getMediaKey(media)}`}
                    type="button"
                    onClick={() => onSelect(media)}
                    className="type-action flex w-full items-center gap-3 px-4 py-2.5 text-left text-brand-silver transition-colors hover:bg-brand-cyan/10 hover:text-white"
                  >
                    <div className="h-12 w-8 shrink-0 overflow-hidden rounded-md bg-brand-bg/80 ring-1 ring-white/10">
                      {posterUrl ? (
                        <Image src={posterUrl} alt="" width={32} height={48} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-brand-silver/40"><Film size={14} /></div>
                      )}
                    </div>
                    <span className="min-w-0 flex-1 truncate">{getMediaTitle(media)}</span>
                    <span className="type-micro shrink-0 rounded-full bg-white/10 px-2 py-1 text-brand-silver/70">
                      {contentRating || 'N/A'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    ) : (
      <div className="py-20 text-center text-brand-silver">
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg font-medium text-white">{emptyTitle}</p>
          <p className="mx-auto max-w-xs text-sm text-brand-silver">{emptyDescription}</p>
          {failureCount > 0 && (
            <p className="text-xs text-brand-silver/60">
              {failureCount} {failureCount === 1 ? 'title could' : 'titles could'} not be checked.
            </p>
          )}
        </div>
      </div>
    )}
  </div>
);
