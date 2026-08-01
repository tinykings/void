'use client';

import { Suspense, useEffect } from 'react';
import { SearchSheet } from '@/components/SearchSheet';
import { GithubConnectGate } from '@/components/GithubConnectGate';
import { useAppContext } from '@/context/AppContext';

function SearchPageContent() {
  const { isGithubConnected, isLoaded, setIsSearchFocused } = useAppContext();
  const requiresGithubConnection = process.env.NODE_ENV !== 'development'
    || process.env.NEXT_PUBLIC_REQUIRE_GITHUB_IN_DEV === 'true';

  useEffect(() => {
    if (isLoaded) setIsSearchFocused(true);
    return () => setIsSearchFocused(false);
  }, [isLoaded, setIsSearchFocused]);

  if (!isLoaded) return null;
  if (requiresGithubConnection && !isGithubConnected) return <GithubConnectGate />;

  return <SearchSheet />;
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageContent />
    </Suspense>
  );
}
