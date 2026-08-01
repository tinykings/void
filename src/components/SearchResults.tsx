import { MediaCard } from '@/components/MediaCard';
import { getMediaKey } from '@/lib/media';
import type { Media } from '@/lib/types';

type SearchResultsProps = {
  hasSubmittedSearch: boolean;
  isLoading: boolean;
  media: Media[];
  query: string;
};

export const SearchResults = ({ hasSubmittedSearch, isLoading, media, query }: SearchResultsProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {[...Array(8)].map((_, index) => (
          <div key={index} className="aspect-[2/3] animate-pulse rounded-xl bg-white/10" />
        ))}
      </div>
    );
  }

  if (media.length > 0) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {media.map((item) => (
          <MediaCard key={getMediaKey(item)} media={item} showReleaseBadge={false} showCaption />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-white/10 px-5 py-14 text-center">
      <p className="type-title text-white">
        {hasSubmittedSearch ? `No matches for “${query}”` : 'Nothing trending right now'}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-brand-silver">
        {hasSubmittedSearch ? 'Check spelling, try a shorter title, or change the media filter.' : 'Check your connection and try again.'}
      </p>
    </div>
  );
};
