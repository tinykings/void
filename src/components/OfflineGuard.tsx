'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineGuard = ({ children }: { children: React.ReactNode }) => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Initial check
    setIsOnline(window.navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="fixed inset-0 z-[1000] bg-gray-950 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
        <div className="w-20 h-20 bg-red-500/20 rounded-3xl flex items-center justify-center mb-8 text-red-400">
          <WifiOff size={48} />
        </div>
        
        <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-4">
          Connection Required
        </h1>
        
        <p className="text-gray-400 max-w-xs mb-10 leading-relaxed">
          Void requires an active internet connection to sync your library and fetch latest movie data.
        </p>

        <button 
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all active:scale-95 uppercase tracking-widest shadow-lg shadow-indigo-900/40"
        >
          <RefreshCw size={20} />
          Retry Connection
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
