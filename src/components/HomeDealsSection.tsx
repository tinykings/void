import Image from 'next/image';
import { ExternalLink, Gamepad2 } from 'lucide-react';
import { formatGamePrice } from '@/lib/ggDeals';
import { getImageSrc, getMediaKey, getMediaTitle } from '@/lib/media';
import type { GameDeal } from '@/lib/gameDeals';
import type { Media } from '@/lib/types';

const getCoverUrl = (media: Media) => media.poster_path
  ? getImageSrc(media.poster_path, (path) => path)
  : '';

type HomeDealsSectionProps = {
  deals: GameDeal[];
  emptyDescription: string;
  emptyTitle: string;
  failureCount: number;
  isLoading: boolean;
  onSelect: (media: Media) => void;
  playlistCount: number;
  unavailableCount: number;
};

export const HomeDealsSection = ({
  deals,
  emptyDescription,
  emptyTitle,
  failureCount,
  isLoading,
  onSelect,
  playlistCount,
  unavailableCount,
}: HomeDealsSectionProps) => (
  <div className="mx-auto max-w-3xl space-y-3">
    <div className="flex items-start justify-between gap-4 px-1">
      <div className="min-w-0">
        <h1 className="type-display text-white">Deals</h1>
        <p className="mt-1 text-xs font-medium text-brand-silver">
          Current US prices for playlist games, including titles not on sale. Data provided by GG.deals.
        </p>
      </div>
      <div className="type-readout rounded-full border border-brand-cyan/20 bg-brand-cyan/10 px-3 py-1 text-brand-cyan">
        {playlistCount}
      </div>
    </div>

    {isLoading ? (
      <div className="space-y-2 pt-3">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-xl blueprint-border bg-white/[0.03]" />
        ))}
      </div>
    ) : deals.length > 0 ? (
      <div className="space-y-3 pt-2">
        {(failureCount > 0 || unavailableCount > 0) && (
          <p className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs font-medium text-amber-100">
            {failureCount > 0 && `${failureCount} ${failureCount === 1 ? 'game could' : 'games could'} not be checked.`}
            {failureCount > 0 && unavailableCount > 0 && ' '}
            {unavailableCount > 0 && `${unavailableCount} ${unavailableCount === 1 ? 'game has' : 'games have'} no current GG.deals price.`}
          </p>
        )}
        <section className="overflow-hidden rounded-xl blueprint-border bg-white/[0.03]">
          <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
            <h2 className="type-title text-white">Lowest first</h2>
            <span className="type-readout shrink-0 text-brand-silver/60">USD</span>
          </div>
          <div className="divide-y divide-white/5">
            {deals.map(({ media, price }, index) => {
              const coverUrl = getCoverUrl(media);
              const formattedPrice = formatGamePrice(price);
              return (
                <div key={getMediaKey(media)} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-brand-cyan/[0.06]">
                  <span className="type-readout w-5 shrink-0 text-right text-brand-silver/35">{index + 1}</span>
                  <button type="button" onClick={() => onSelect(media)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-brand-bg/80 ring-1 ring-white/10">
                      {coverUrl ? (
                        <Image src={coverUrl} alt="" width={36} height={48} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-brand-silver/40"><Gamepad2 size={14} /></div>
                      )}
                    </div>
                    <span className="type-action min-w-0 flex-1 truncate text-brand-silver transition-colors group-hover:text-white">
                      {getMediaTitle(media)}
                    </span>
                  </button>
                  <a
                    href={price.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${getMediaTitle(media)} ${formattedPrice} on GG.deals`}
                    className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-cyan/10 px-2.5 py-2 text-brand-cyan transition-colors hover:bg-brand-cyan/20 hover:text-white"
                  >
                    <span className="type-readout text-base">{formattedPrice}</span>
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    ) : (
      <div className="py-20 text-center text-brand-silver">
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg font-medium text-white">{emptyTitle}</p>
          <p className="mx-auto max-w-xs text-sm text-brand-silver">{emptyDescription}</p>
          {failureCount > 0 && <p className="text-xs text-brand-silver/60">{failureCount} games could not be checked.</p>}
        </div>
      </div>
    )}
  </div>
);
