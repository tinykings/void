'use client';

import { Suspense } from 'react';
import { HomeView } from '@/components/views/HomeView';
import { useAppContext } from '@/context/AppContext';

function MainContent() {
  const { isLoaded } = useAppContext();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-brand-cyan border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(34,211,238,0.2)]" />
      </div>
    );
  }

  return (
    <HomeView />
  );
}

export default function RootPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MainContent />
    </Suspense>
  );
}
