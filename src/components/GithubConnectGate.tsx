'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Github, LoaderCircle, LockKeyhole } from 'lucide-react';
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
    <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
      <section aria-labelledby="connect-title" className="w-full max-w-[460px] text-center">
        <div className="mb-8 flex flex-col items-center gap-4">
          <Image
            src={logoPng}
            alt=""
            priority
            className="h-32 w-32 rounded-[28px] object-cover sm:h-36 sm:w-36"
          />
          <p className="type-display text-slate-50">Void</p>
        </div>

        <div className="border-y border-blueprint-border py-7">
          <h1 id="connect-title" className="text-balance text-sm font-medium leading-6 text-slate-50">
            Track movies, shows, and games. Your library lives in this browser; GitHub Gist adds backup and cross-device sync.
          </h1>
        </div>

        <div className="pt-6">
          <div className="mb-4 flex items-start justify-center gap-3 text-xs leading-5 text-brand-silver">
            <LockKeyhole size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-cyan" />
            <p>
              GitHub will request <strong className="font-semibold text-slate-200">Gist read and write access</strong>. Void uses it only for your private sync file.
            </p>
          </div>

          <button
            type="button"
            onClick={handleConnect}
            disabled={isConnecting}
            className="type-action flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-brand-cyan px-5 py-3.5 text-brand-bg transition-colors hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-4 focus-visible:ring-offset-brand-bg active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
          >
            {isConnecting ? <LoaderCircle size={19} aria-hidden="true" className="animate-spin" /> : <Github size={19} aria-hidden="true" />}
            {isConnecting ? 'Connecting GitHub' : 'Connect GitHub'}
          </button>

          <a
            href="https://github.com/tinykings/void"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-xs text-brand-silver underline decoration-white/25 underline-offset-4 transition-colors hover:text-slate-50 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
          >
            View source on GitHub
          </a>

          <details id="privacy-details" className="group mt-2 text-xs leading-5 text-brand-silver">
            <summary className="mx-auto w-fit cursor-pointer list-none underline decoration-white/25 underline-offset-4 transition-colors hover:text-slate-50 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan [&::-webkit-details-marker]:hidden">
              Privacy details
            </summary>
            <div className="mt-4 rounded-lg border border-blueprint-border bg-surface-raised/30 p-4">
              <p>
                GitHub&apos;s Gist permission can access your Gists. Void only looks for or creates <code className="type-readout text-slate-200">void-data.json</code>, then reads and updates that private Gist to sync your library.
              </p>
              <p className="mt-3">
                Your GitHub username, sync file ID, and access token are stored in this browser&apos;s IndexedDB. Void does not create a profile, publish activity, or send your library to its own server.
              </p>
            </div>
          </details>
        </div>
      </section>
    </main>
  );
};
