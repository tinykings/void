'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ActorSheet } from '@/components/ActorSheet';
import { GithubConnectGate } from '@/components/GithubConnectGate';
import { useAppContext } from '@/context/AppContext';
import type { CastMember } from '@/lib/types';

function PersonSkeleton() {
  return (
    <div className="page-surface px-4 pb-24 pt-4" aria-label="Loading person details">
      <div className="h-6 w-1/2 rounded skeleton-shimmer animate-shimmer" />
      <div className="mt-6 rounded-xl border border-white/10 p-4">
        <div className="float-right ml-4 aspect-square w-24 rounded-xl skeleton-shimmer animate-shimmer" />
        <div className="space-y-3">
          <div className="h-4 w-24 rounded skeleton-shimmer animate-shimmer" />
          <div className="h-4 w-2/3 rounded skeleton-shimmer animate-shimmer" />
          <div className="h-4 w-full rounded skeleton-shimmer animate-shimmer" />
        </div>
      </div>
    </div>
  );
}

function PersonPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeActorMedia, closeAllSheets, isGithubConnected, isLoaded, openActor } = useAppContext();
  const requiresGithubConnection = process.env.NODE_ENV !== 'development'
    || process.env.NEXT_PUBLIC_REQUIRE_GITHUB_IN_DEV === 'true';
  const closeAllSheetsRef = useRef(closeAllSheets);

  useEffect(() => {
    closeAllSheetsRef.current = closeAllSheets;
  }, [closeAllSheets]);

  const requestedPerson = useMemo<CastMember | null>(() => {
    const id = Number(searchParams.get('id'));
    if (!Number.isFinite(id)) return null;
    try {
      const cached = JSON.parse(sessionStorage.getItem('void_person') || 'null') as CastMember | null;
      if (cached?.id === id) return cached;
    } catch {
      // Ignore malformed session cache.
    }
    return {
      id,
      name: searchParams.get('name') || 'Loading person',
      character: '',
      profile_path: null,
      order: 0,
    };
  }, [searchParams]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!requestedPerson) {
      router.replace('/');
      return;
    }
    if (activeActorMedia?.id !== requestedPerson.id) openActor(requestedPerson);
  }, [activeActorMedia, isLoaded, openActor, requestedPerson, router]);

  useEffect(() => () => closeAllSheetsRef.current(), []);

  if (!isLoaded || !requestedPerson || !activeActorMedia) return <PersonSkeleton />;
  if (requiresGithubConnection && !isGithubConnected) return <GithubConnectGate />;
  return <ActorSheet />;
}

export default function PersonPage() {
  return (
    <Suspense fallback={<PersonSkeleton />}>
      <PersonPageContent />
    </Suspense>
  );
}
