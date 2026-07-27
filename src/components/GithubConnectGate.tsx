'use client';

import { useState } from 'react';
import { Github, LoaderCircle, LockKeyhole } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { buildGistPayload } from '@/lib/gist';
import { connectGithub, findOrCreateAppGist } from '@/lib/githubOAuth';

export const GithubConnectGate = () => {
  const {
    watchlist,
    watched,
    playedEpisodes,
    setGithubConnection,
    syncFromGist,
  } = useAppContext();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setError(null);

    try {
      const { token, login } = await connectGithub();
      const gistId = await findOrCreateAppGist(
        token,
        buildGistPayload(watchlist, watched, playedEpisodes),
      );
      setGithubConnection(gistId, token, login);
      await syncFromGist(true);
    } catch (connectionError) {
      setError(connectionError instanceof Error ? connectionError.message : 'Could not connect GitHub.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,0.12),transparent_34%)]" />
      <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-[480px] w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-transparent via-brand-cyan/25 to-transparent" />

      <section className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-brand-bg/85 p-7 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-9">
        <div className="mb-10 flex items-center justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan shadow-[0_0_28px_rgba(34,211,238,0.12)]">
            <LockKeyhole size={21} />
          </div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-brand-silver/50">Private sync</span>
        </div>

        <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.24em] text-brand-cyan">Void / entry</p>
        <h1 className="max-w-sm text-4xl font-black leading-[0.95] tracking-[-0.045em] text-white sm:text-5xl">
          Your collection starts with GitHub.
        </h1>
        <p className="mt-5 max-w-sm text-sm leading-6 text-brand-silver">
          Connect once to keep playlist, history, ratings, and episodes in private Gist storage.
        </p>

        <button
          type="button"
          onClick={handleConnect}
          disabled={isConnecting}
          className="mt-9 flex w-full items-center justify-center gap-3 rounded-xl bg-white px-5 py-3.5 text-sm font-black text-brand-bg transition-all hover:bg-brand-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-4 focus-visible:ring-offset-brand-bg active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        >
          {isConnecting ? <LoaderCircle size={19} className="animate-spin" /> : <Github size={19} />}
          {isConnecting ? 'Connecting GitHub' : 'Connect GitHub'}
        </button>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <p className="mt-5 text-center text-[11px] leading-5 text-brand-silver/50">
          GitHub grants Gist access. Void never asks for your password.
        </p>
      </section>
    </main>
  );
};
