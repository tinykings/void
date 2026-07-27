'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Github, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppContext } from '@/context/AppContext';
import { buildGistPayload } from '@/lib/gist';
import { connectGithub, findOrCreateAppGist } from '@/lib/githubOAuth';
import logoPng from '../../public/logo.png';

export const GithubConnectGate = () => {
  const {
    watchlist,
    watched,
    playedEpisodes,
    setGithubConnection,
    syncFromGist,
  } = useAppContext();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);

    try {
      const { token, login } = await connectGithub();
      const gistId = await findOrCreateAppGist(
        token,
        buildGistPayload(watchlist, watched, playedEpisodes),
      );
      setGithubConnection(gistId, token, login);
      await syncFromGist(true);
    } catch (connectionError) {
      toast.error(connectionError instanceof Error ? connectionError.message : 'Could not connect GitHub.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="flex w-full max-w-xs flex-col items-center gap-8">
        <Image
          src={logoPng}
          alt="Void"
          priority
          className="h-32 w-32 rounded-[28px] object-cover"
        />

        <button
          type="button"
          onClick={handleConnect}
          disabled={isConnecting}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-5 py-3.5 text-sm font-black text-brand-bg transition-all hover:bg-brand-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-4 focus-visible:ring-offset-brand-bg active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        >
          {isConnecting ? <LoaderCircle size={19} className="animate-spin" /> : <Github size={19} />}
          {isConnecting ? 'Connecting GitHub' : 'Connect GitHub'}
        </button>
      </div>
    </main>
  );
};
