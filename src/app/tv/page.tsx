'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Monitor, Wifi, WifiOff, ExternalLink, Settings } from 'lucide-react';

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
    } else {
      const savedId = localStorage.getItem('void_tv_gist_id');
      if (savedId) {
        setGistId(savedId);
      } else {
        setStatus('not-configured');
      }
    }

    // Load last processed timestamp to avoid re-triggering old items
    const savedTimestamp = localStorage.getItem('void_tv_last_timestamp');
    if (savedTimestamp) {
      lastProcessedTimestamp.current = parseInt(savedTimestamp, 10);
    }
  }, [searchParams]);

  const pollGist = useCallback(async () => {
    if (!gistId) return;

    try {
      // Fetch public gist (no token needed for public gists)
      const res = await fetch(`https://api.github.com/gists/${gistId}?_=${Date.now()}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!res.ok) {
        if (res.status === 404) {
          setStatus('error');
        }
        return;
      }

      const data = await res.json();
      const queueFile = data.files?.['void-tv-queue.json'];
      if (!queueFile?.content) {
        setStatus('waiting');
        return;
      }

      const parsed: TvQueueItem = JSON.parse(queueFile.content);
      if (!parsed.url || !parsed.timestamp) {
        setStatus('waiting');
        return;
      }

      // Only process if this is a new item we haven't seen
      if (parsed.timestamp > lastProcessedTimestamp.current) {
        lastProcessedTimestamp.current = parsed.timestamp;
        localStorage.setItem('void_tv_last_timestamp', parsed.timestamp.toString());
        setLastItem(parsed);
        setStatus('received');

        // Navigate to the URL
        window.location.href = parsed.url;
      } else {
        setStatus('waiting');
      }
    } catch (err) {
      console.error('TV poll error:', err);
    }
  }, [gistId]);

  useEffect(() => {
    if (!gistId) return;

    setStatus('waiting');
    
    // Start polling
    pollGist();
    pollInterval.current = setInterval(pollGist, 5000);

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
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
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-green-500/20 blueprint-border flex items-center justify-center">
                <ExternalLink size={40} className="text-green-400" />
              </div>
              <p className="text-white font-bold">{lastItem.title}</p>
              <p className="text-brand-silver text-sm">Opening content...</p>
              <a
                href={lastItem.url}
                className="text-xs text-brand-cyan hover:underline"
              >
                Click here if it doesn't open
              </a>
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
