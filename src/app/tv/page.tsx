'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getGistContent, GistContent } from '@/lib/gist';
import { Play, Tv, RefreshCw } from 'lucide-react';

function TvPageContent() {
  const searchParams = useSearchParams();
  const gistId = searchParams.get('gistId');
  const [content, setContent] = useState<GistContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!gistId) {
      setLoading(false);
      return;
    }

    const fetchContent = async () => {
      const data = await getGistContent(gistId);
      setContent(data);
      setLastUpdated(new Date());
      setLoading(false);
    };

    fetchContent();

    const interval = setInterval(fetchContent, 5000);
    return () => clearInterval(interval);
  }, [gistId]);

  const handlePlay = () => {
    if (content?.url) {
      window.open(content.url, '_blank');
    }
  };

  const getTimeSince = (date: Date | null) => {
    if (!date) return '';
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  if (!gistId) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-8">
        <Tv className="w-24 h-24 text-brand-silver mb-8" />
        <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-4 text-center">
          TV Remote
        </h1>
        <p className="text-brand-silver text-center max-w-md">
          No Gist ID provided. Add <code className="text-brand-cyan">?gistId=YOUR_GIST_ID</code> to the URL.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-center gap-3 mb-12">
          <Tv className="w-12 h-12 text-brand-cyan" />
          <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">
            TV Remote
          </h1>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="w-12 h-12 text-brand-cyan animate-spin" />
            <p className="text-brand-silver">Loading...</p>
          </div>
        ) : content ? (
          <div className="flex flex-col items-center gap-8">
            <div className="text-center">
              <p className="text-brand-silver text-sm uppercase tracking-widest mb-2">Now Playing</p>
              <h2 className="text-3xl font-black text-white tracking-tight">
                {content.title}
              </h2>
            </div>

            <button
              onClick={handlePlay}
              className="w-full max-w-md py-8 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 bg-brand-cyan text-brand-bg text-2xl flex items-center justify-center gap-4 shadow-[0_0_40px_rgba(34,211,238,0.3)]"
            >
              <Play size={40} className="fill-brand-bg" />
              Play
            </button>

            <div className="flex items-center gap-2 text-brand-silver text-sm">
              <RefreshCw size={14} className="animate-spin opacity-50" />
              <span>Last updated: {getTimeSince(lastUpdated)}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Tv className="w-16 h-16 text-brand-silver" />
            <p className="text-brand-silver text-center">
              No media queued. Send something from the Void app.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TvPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <RefreshCw className="w-12 h-12 text-brand-cyan animate-spin" />
      </div>
    }>
      <TvPageContent />
    </Suspense>
  );
}
