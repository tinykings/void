'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Monitor, Wifi, WifiOff, ExternalLink } from 'lucide-react';

interface TvQueueItem {
  url: string;
  title: string;
  timestamp: number;
}

export default function TvPage() {
  const { tvGistId, tvGistToken, isLoaded } = useAppContext();
  const [status, setStatus] = useState<'waiting' | 'received' | 'error' | 'not-configured'>('waiting');
  const [lastItem, setLastItem] = useState<TvQueueItem | null>(null);
  const lastProcessedTimestamp = useRef<number>(0);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearQueue = useCallback(async () => {
    if (!tvGistId || !tvGistToken) return;
    try {
      await fetch(`https://api.github.com/gists/${tvGistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${tvGistToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: { 'void-tv-queue.json': { content: '{}' } },
        }),
      });
    } catch (err) {
      console.error('Failed to clear TV queue:', err);
    }
  }, [tvGistId, tvGistToken]);

  const pollGist = useCallback(async () => {
    if (!tvGistId || !tvGistToken) return;

    try {
      const res = await fetch(`https://api.github.com/gists/${tvGistId}?_=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${tvGistToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'If-None-Match': '',
        },
      });

      if (!res.ok) {
        setStatus('error');
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
        setLastItem(parsed);
        setStatus('received');

        // Clear the queue and navigate to the URL
        await clearQueue();
        window.location.href = parsed.url;
      }
    } catch (err) {
      console.error('TV poll error:', err);
      // Don't set error status for transient network issues
    }
  }, [tvGistId, tvGistToken, clearQueue]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!tvGistId || !tvGistToken) {
      setStatus('not-configured');
      return;
    }

    setStatus('waiting');

    // Clear any existing queue on mount so we don't immediately open stale URLs
    clearQueue();

    // Start polling
    pollGist();
    pollInterval.current = setInterval(pollGist, 5000);

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [isLoaded, tvGistId, tvGistToken, pollGist, clearQueue]);

  // No reset needed — page navigates away on receive

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
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-red-500/20 blueprint-border flex items-center justify-center">
                <WifiOff size={40} className="text-red-400" />
              </div>
              <p className="text-brand-silver">
                TV support is not configured. Enable it in Settings on this device.
              </p>
            </div>
          )}

          {status === 'waiting' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-brand-cyan/10 blueprint-border flex items-center justify-center animate-pulse">
                <Monitor size={40} className="text-brand-cyan" />
              </div>
              <div className="flex items-center gap-2 text-brand-cyan">
                <Wifi size={16} />
                <span className="text-sm font-bold">Waiting for content...</span>
              </div>
              <p className="text-brand-silver text-xs">
                Send something from VOID on your phone
              </p>
            </div>
          )}

          {status === 'received' && lastItem && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-green-500/20 blueprint-border flex items-center justify-center">
                <ExternalLink size={40} className="text-green-400" />
              </div>
              <p className="text-white font-bold">{lastItem.title}</p>
              <p className="text-brand-silver text-sm">Opened in new tab</p>
              <a
                href={lastItem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-cyan hover:underline"
              >
                Open again
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
                Could not reach GitHub Gist. Check your configuration.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
