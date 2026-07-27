'use client';

import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export const OfflineGuard = ({ children }: { children: React.ReactNode }) => {
  const isOnline = useOnlineStatus();

  return (
    <>
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-[1000] flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-amber-300/25 bg-brand-bg/95 px-4 py-3 text-left shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300">
            <WifiOff size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="type-label text-white">Offline mode</p>
            <p className="type-body text-brand-silver">
              Your saved collection is available. Search, sync, and metadata updates will resume when connected.
            </p>
          </div>
        </div>
      )}
      {children}
    </>
  );
};
