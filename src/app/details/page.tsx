'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ActorSheet } from '@/components/ActorSheet';
import { DetailsSheet } from '@/components/DetailsSheet';
import { GithubConnectGate } from '@/components/GithubConnectGate';
import { useAppContext } from '@/context/AppContext';
import { getMediaKey } from '@/lib/media';
import type { Media, MediaSource, MediaType } from '@/lib/types';

const mediaTypes = new Set<MediaType>(['movie', 'tv', 'game']);
const mediaSources = new Set<MediaSource>(['tmdb', 'igdb', 'rawg', 'steam']);

function DetailsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    activeDetailsMedia,
    closeAllSheets,
    isGithubConnected,
    isLoaded,
    openDetails,
    watched,
    watchlist,
  } = useAppContext();
  const requiresGithubConnection = process.env.NODE_ENV !== 'development'
    || process.env.NEXT_PUBLIC_REQUIRE_GITHUB_IN_DEV === 'true';

  const requestedMedia = useMemo<Media | null>(() => {
    const id = Number(searchParams.get('id'));
    const type = searchParams.get('type') as MediaType | null;
    const source = searchParams.get('source') as MediaSource | null;
    if (!Number.isFinite(id) || !type || !source || !mediaTypes.has(type) || !mediaSources.has(source)) return null;

    const key = `${source}-${type}-${id}`;
    const saved = [...watchlist, ...watched].find((item) => getMediaKey(item) === key);
    if (saved) return saved;

    try {
      const cached = JSON.parse(sessionStorage.getItem('void_details_media') || 'null') as Media | null;
      if (cached && getMediaKey(cached) === key) return cached;
    } catch {
      // Ignore malformed session cache and fetch from route identity.
    }

    const title = searchParams.get('title') || 'Loading details';
    return {
      id,
      media_type: type,
      source,
      title: type === 'tv' ? undefined : title,
      name: type === 'tv' ? title : undefined,
      poster_path: null,
      backdrop_path: null,
      overview: '',
      vote_average: 0,
      popularity: 0,
    };
  }, [searchParams, watched, watchlist]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!requestedMedia) {
      router.replace('/');
      return;
    }
    if (!activeDetailsMedia || getMediaKey(activeDetailsMedia) !== getMediaKey(requestedMedia)) {
      openDetails(requestedMedia);
    }
  }, [activeDetailsMedia, isLoaded, openDetails, requestedMedia, router]);

  useEffect(() => () => closeAllSheets(), [closeAllSheets]);

  if (!isLoaded || !requestedMedia) return null;
  if (requiresGithubConnection && !isGithubConnected) return <GithubConnectGate />;

  return (
    <>
      <DetailsSheet />
      <ActorSheet />
    </>
  );
}

export default function DetailsPage() {
  return (
    <Suspense fallback={null}>
      <DetailsPageContent />
    </Suspense>
  );
}
