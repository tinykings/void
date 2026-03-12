'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Monitor, Wifi, WifiOff, ExternalLink, Settings, Play } from 'lucide-react';

interface TvQueueItem {
  url: string;
  title: string;
  timestamp: number;
}

function TvPageContent() {
  const searchParams = useSearchParams();
  const [gistId, setGistId] = useState<string | null>(null);
  const [status, setStatus] = useState<'waiting' | 'received' | 'error' | 'not-configured'>('waiting');
  const [lastItem, setLastItem] = useState<TvQueueItem | null>(null);
  const lastProcessedTimestamp = useRef<number>(0);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tempGistId, setTempGistId] = useState('');

  // Load gist ID from URL or localStorage
  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl) {
      setGistId(idFromUrl);
      localStorage.setItem('void_tv_gist_id', idFromUrl);
    }
    
    // Initial load from localStorage for Gist ID
    const savedId = localStorage.getItem('void_tv_gist_id');
    if (savedId && !idFromUrl) {
      setGistId(savedId);
    } else if (!idFromUrl && !savedId) {
      setStatus('not-configured');
    }

    // We don't load the last timestamp from localStorage here 
    // so that opening the page always shows the "current" queued item.
  }, [searchParams]);

  const pollGist = useCallback(async () => {
    if (!gistId) return;

    try {
      const res = await fetch(`https://api.github.com/gists/${gistId}?_=${Date.now()}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!res.ok) return;

      const data = await res.json();
      const queueFile = data.files?.['void-tv-queue.json'];
      if (!queueFile?.content) return;

      const parsed: TvQueueItem = JSON.parse(queueFile.content);
      if (!parsed.url || !parsed.timestamp) return;

      // Only process if this is a new item we haven't seen in this session
      if (parsed.timestamp > lastProcessedTimestamp.current) {
        lastProcessedTimestamp.current = parsed.timestamp;
        setLastItem(parsed);
        setStatus('received');
      }
    } catch (err) {
      console.error('TV poll error:', err);
    }
  }, [gistId]);

  useEffect(() => {
    if (!gistId) return;

    // Start polling immediately
    pollGist();
    const interval = setInterval(pollGist, 5000);

    return () => clearInterval(interval);
  }, [gistId, pollGist]);

  const handleConfigure = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempGistId.trim()) {
      setGistId(tempGistId.trim());
      localStorage.setItem('void_tv_gist_id', tempGistId.trim());
      setStatus('waiting');
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md w-full">
        {/* Logo */}
        <h1 className="text-5xl font-black text-white uppercase italic tracking-tighter mb-2">
          V<span className="text-brand-cyan">O</span>ID
        </h1>
        <p className="text-brand-silver text-sm mb-12">TV Receiver</p>

        {/* Status */}
        <div className="mb-8">
          {status === 'not-configured' && (
            <div className="flex flex-col items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-brand-bg blueprint-border flex items-center justify-center">
                <Settings size={40} className="text-brand-silver" />
              </div>
              <div className="space-y-2">
                <p className="text-white font-bold">Configure TV Receiver</p>
                <p className="text-brand-silver text-sm">
                  Enter your Public Gist ID to receive content.
                </p>
              </div>
              <form onSubmit={handleConfigure} className="w-full space-y-3">
                <input
                  type="text"
                  value={tempGistId}
                  onChange={(e) => setTempGistId(e.target.value)}
                  placeholder="Gist ID"
                  className="w-full p-4 rounded-xl bg-brand-bg blueprint-border text-white text-center focus:ring-2 focus:ring-brand-cyan outline-none transition-all placeholder:text-brand-silver/50"
                />
                <button
                  type="submit"
                  className="w-full py-4 bg-brand-cyan text-brand-bg font-black rounded-xl uppercase tracking-widest hover:bg-brand-cyan/90 transition-all"
                >
                  Connect
                </button>
              </form>
            </div>
          )}

          {status === 'waiting' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-brand-cyan/10 blueprint-border flex items-center justify-center animate-pulse">
                <Monitor size={40} className="text-brand-cyan" />
              </div>
              <div className="flex items-center gap-2 text-brand-cyan">
                <Wifi size={16} />
                <span className="text-sm font-bold uppercase tracking-wider">Waiting for content...</span>
              </div>
              <p className="text-brand-silver text-xs">
                Send something from VOID on your phone
              </p>
              <button 
                onClick={() => setStatus('not-configured')}
                className="mt-8 text-xs text-brand-silver/50 hover:text-brand-silver underline transition-colors"
              >
                Change Gist ID
              </button>
            </div>
          )}

          {status === 'received' && lastItem && (
            <div className="flex flex-col items-center gap-6 animate-in zoom-in duration-300">
              <div className="w-24 h-24 rounded-full bg-green-500/20 blueprint-border flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                <Play size={48} className="text-green-400 fill-current ml-1" />
              </div>
              <div className="space-y-2">
                <p className="text-white text-2xl font-black uppercase italic tracking-tighter">{lastItem.title}</p>
                <p className="text-brand-silver text-sm uppercase tracking-widest font-bold">New Content Ready</p>
              </div>
              <a
                href={lastItem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-6 bg-brand-cyan text-brand-bg font-black rounded-2xl uppercase tracking-[0.2em] text-xl hover:bg-brand-cyan/90 transition-all shadow-[0_0_40px_rgba(34,211,238,0.3)] active:scale-95 flex items-center justify-center gap-3"
              >
                <Play size={24} className="fill-brand-bg" />
                Play Now
              </a>
              <button 
                onClick={() => setStatus('waiting')}
                className="text-xs text-brand-silver/50 hover:text-brand-silver underline transition-colors mt-4"
              >
                Dismiss
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-red-500/20 blueprint-border flex items-center justify-center">
                <WifiOff size={40} className="text-red-400" />
              </div>
              <p className="text-red-400 font-bold">Connection Error</p>
              <p className="text-brand-silver text-xs">
                Could not reach GitHub Gist. Check your Gist ID.
              </p>
              <button 
                onClick={() => setStatus('not-configured')}
                className="mt-4 py-2 px-4 bg-brand-bg blueprint-border rounded-lg text-xs text-white"
              >
                Reconfigure
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TvPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-bg flex items-center justify-center text-brand-cyan">Loading...</div>}>
      <TvPageContent />
    </Suspense>
  );
}
