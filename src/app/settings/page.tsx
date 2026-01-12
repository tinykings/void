'use client';

import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Key, Save, ExternalLink, Moon, Github, RefreshCw } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { clsx } from 'clsx';

export default function SettingsPage() {
  const { apiKey, setApiKey, githubToken, setGithubToken, gistId, setGistId, syncFromGist, isSyncing, vidAngelEnabled, setVidAngelEnabled } = useAppContext();
  
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempGithubToken, setTempGithubToken] = useState('');
  const [tempGistId, setTempGistId] = useState('');
  const [tempVidAngelEnabled, setTempVidAngelEnabled] = useState(false);
  
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTempApiKey(apiKey);
    setTempGithubToken(githubToken || '');
    setTempGistId(gistId || '');
    setTempVidAngelEnabled(vidAngelEnabled || false);
  }, [apiKey, githubToken, gistId, vidAngelEnabled]);

  const handleSave = () => {
    setApiKey(tempApiKey);
    setGithubToken(tempGithubToken);
    setGistId(tempGistId);
    setVidAngelEnabled(tempVidAngelEnabled);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    
    // Trigger a sync if credentials are present
    if (tempGithubToken && tempGistId) {
      syncFromGist();
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto pb-24">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Settings</h1>
      
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
            <div className="bg-indigo-600 rounded-full p-1">
              <span className="text-white font-bold text-xs px-1">VA</span>
            </div>
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

        <section className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <Github className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">GitHub Sync</h2>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Sync your watchlist and history across devices using a GitHub Gist.
            Create a private Gist with a file named <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-xs">couch_data.json</code> containing <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-xs">{"{}"}</code>.
            You'll need a Fine-grained Personal Access Token with "Gists" (Read and Write) permission.
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
            Couch v1.1.0<br />
            Data provided by TMDB.
          </p>
        </section>
      </div>
    </div>
  );
}