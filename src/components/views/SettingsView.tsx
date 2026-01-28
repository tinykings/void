'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Key, Save, ExternalLink, Moon, Github, RefreshCw, ArrowLeft, ShieldCheck, Play } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { clsx } from 'clsx';
import { externalPlayerOptions } from '@/lib/types';

export const SettingsView = () => {
  const router = useRouter();
  const {
    apiKey, setApiKey,
    githubToken, setGithubToken,
    gistId, setGistId,
    syncFromGist, isSyncing,
    vidAngelEnabled, setVidAngelEnabled,
    externalPlayerEnabled, toggleExternalPlayerEnabled,
    selectedExternalPlayer, setSelectedExternalPlayerId,
  } = useAppContext();

  const [tempApiKey, setTempApiKey] = useState('');
  const [tempGithubToken, setTempGithubToken] = useState('');
  const [tempGistId, setTempGistId] = useState('');
  const [tempVidAngelEnabled, setTempVidAngelEnabled] = useState(false);
  const [tempExternalPlayerEnabled, setTempExternalPlayerEnabled] = useState(false);
  const [tempSelectedExternalPlayerId, setTempSelectedExternalPlayerId] = useState<string | null>(null);

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTempApiKey(apiKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTempGithubToken(githubToken || '');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTempGistId(gistId || '');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTempVidAngelEnabled(vidAngelEnabled || false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTempExternalPlayerEnabled(externalPlayerEnabled || false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTempSelectedExternalPlayerId(selectedExternalPlayer?.id || null);
  }, [apiKey, githubToken, gistId, vidAngelEnabled, externalPlayerEnabled, selectedExternalPlayer]);

  const handleSave = () => {
    setApiKey(tempApiKey);
    setGithubToken(tempGithubToken);
    setGistId(tempGistId);
    setVidAngelEnabled(tempVidAngelEnabled);
    // Only call toggle if the value has actually changed
    if (tempExternalPlayerEnabled !== externalPlayerEnabled) {
      toggleExternalPlayerEnabled();
    }
    setSelectedExternalPlayerId(tempSelectedExternalPlayerId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    // Trigger a sync if credentials are present
    if (tempGithubToken && tempGistId) {
      syncFromGist();
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => router.replace('/?tab=home')}
          className="p-2 -ml-2 text-gray-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      </div>

      <div className="space-y-6">
        <section className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <Moon className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Appearance</h2>
          </div>
          <ThemeToggle />
        </section>

        <section className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <Key className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">TMDB API Key</h2>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            To use this app, you need a free API key from The Movie Database.
            <a
              href="https://developer.themoviedb.org/reference/intro/getting-started"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-1 font-medium hover:underline"
            >
              Get one here <ExternalLink size={14} />
            </a>
          </p>

          <input
            type="password"
            value={tempApiKey}
            onChange={(e) => setTempApiKey(e.target.value)}
            placeholder="Enter your TMDB API key..."
            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
          />
        </section>

        <section className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Content Filters</h2>
          </div>

          <div className="flex items-center justify-between">
            <div className="pr-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">VidAngel Integration</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Show availability for movies rated R and TV shows rated TV-MA.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!tempVidAngelEnabled}
                onChange={(e) => setTempVidAngelEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {tempVidAngelEnabled && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-3 italic">
                Note: To check availability, you must be logged in to your VidAngel account in this browser.
              </p>
              <a
                href="https://www.vidangel.com/login"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-lg border border-amber-100 dark:border-amber-900/30 hover:bg-amber-100 transition-colors"
              >
                <ExternalLink size={12} />
                Login to VidAngel
              </a>
            </div>
          )}
        </section>

        {/* New External Player Section */}
        <section className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <Play className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">External Player</h2>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="pr-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Enable External Player Links</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Add &quot;Play&quot; links to media details pages for external streaming.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!tempExternalPlayerEnabled}
                onChange={() => {
                  setTempExternalPlayerEnabled(!tempExternalPlayerEnabled);
                  // If disabling, also clear selected player
                  if (tempExternalPlayerEnabled) {
                    setTempSelectedExternalPlayerId(null);
                  } else {
                    // If enabling and no player is selected, select the first one by default
                    if (!tempSelectedExternalPlayerId && externalPlayerOptions.length > 0) {
                      setTempSelectedExternalPlayerId(externalPlayerOptions[0].id);
                    }
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {tempExternalPlayerEnabled && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Select Player</h3>
              <select
                value={tempSelectedExternalPlayerId || ''}
                onChange={(e) => setTempSelectedExternalPlayerId(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              >
                <option value="" disabled>Select an external player</option>
                {externalPlayerOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </div>
          )}
        </section>

        <section className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <Github className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">GitHub Sync</h2>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Sync your watchlist and history across devices using a GitHub Gist.
          </p>

          <div className="space-y-3">
            <div>
               <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1 block">GitHub Token</label>
               <input
                type="password"
                value={tempGithubToken}
                onChange={(e) => setTempGithubToken(e.target.value)}
                placeholder="ghp_..."
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
              />
            </div>
            <div>
               <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1 block">Gist ID</label>
               <input
                type="text"
                value={tempGistId}
                onChange={(e) => setTempGistId(e.target.value)}
                placeholder="e.g. 8f3..."
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
              />
            </div>
          </div>

          {githubToken && gistId && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {isSyncing ? 'Syncing...' : 'Sync Configured'}
              </span>
              <button
                onClick={() => syncFromGist()}
                disabled={isSyncing}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline disabled:opacity-50"
              >
                <RefreshCw size={12} className={clsx(isSyncing && "animate-spin")} />
                Force Pull
              </button>
            </div>
          )}
        </section>

        <button
          onClick={handleSave}
          className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all dark:bg-indigo-600 dark:hover:bg-indigo-500 shadow-lg shadow-indigo-200 dark:shadow-none"
        >
          <Save size={20} />
          {saved ? 'Saved Settings!' : 'Save All Settings'}
        </button>

        <section className="text-center pt-4">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            Void v1.1.0<br />
            Data provided by TMDB.
          </p>
        </section>
      </div>
    </div>
  );
};

