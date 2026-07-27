import { MediaCard } from '@/components/MediaCard';
import { getMediaKey } from '@/lib/media';
import type { Media } from '@/lib/types';

type SearchResultsProps = {
  hasSubmittedSearch: boolean;
  isLoading: boolean;
  media: Media[];
};

export const SearchResults = ({ hasSubmittedSearch, isLoading, media }: SearchResultsProps) => {
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
          <MediaCard key={getMediaKey(item)} media={item} showReleaseBadge={false} />
        ))}
      </div>
    );
  }

  return (
    <p className="py-16 text-center text-sm text-brand-silver">
      {hasSubmittedSearch ? 'Try a different search term.' : 'No titles to show.'}
    </p>
  );
};
