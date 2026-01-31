'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Key, Save, ExternalLink, RefreshCw, ArrowLeft, ShieldCheck, Play, User, LogOut, Download } from 'lucide-react';
import { clsx } from 'clsx';
import { externalPlayerOptions } from '@/lib/types';
import { toast } from 'sonner';

export const SettingsView = () => {
  const router = useRouter();
  const {
    apiKey, setApiKey,
    syncFromTMDB, isSyncing,
    loginWithTMDB, logoutTMDB,
    tmdbSessionId, tmdbAccountId,
    vidAngelEnabled, setVidAngelEnabled,
    externalPlayerEnabled, toggleExternalPlayerEnabled,
    selectedExternalPlayer, setSelectedExternalPlayerId,
    setOnboardingCompleted
  } = useAppContext();

  const [tempApiKey, setTempApiKey] = useState('');
  const [tempVidAngelEnabled, setTempVidAngelEnabled] = useState(false);
  const [tempExternalPlayerEnabled, setTempExternalPlayerEnabled] = useState(false);
  const [tempSelectedExternalPlayerId, setTempSelectedExternalPlayerId] = useState<string | null>(null);

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTempApiKey(apiKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTempVidAngelEnabled(vidAngelEnabled || false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTempExternalPlayerEnabled(externalPlayerEnabled || false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTempSelectedExternalPlayerId(selectedExternalPlayer?.id || null);
  }, [apiKey, vidAngelEnabled, externalPlayerEnabled, selectedExternalPlayer]);

  const handleSave = () => {
    setApiKey(tempApiKey);
    setVidAngelEnabled(tempVidAngelEnabled);
    // Only call toggle if the value has actually changed
    if (tempExternalPlayerEnabled !== externalPlayerEnabled) {
      toggleExternalPlayerEnabled();
    }
    setSelectedExternalPlayerId(tempSelectedExternalPlayerId);
    setSaved(true);
    toast.success('Settings saved successfully');
    
    // Automatically go home after a short delay to show the "Saved" state
    setTimeout(() => {
      setSaved(false);
      router.push('/');
    }, 1000);
  };

  const handleManualSync = async () => {
    await syncFromTMDB(true);
    toast.success('TMDB Synchronization complete');
  };

  const handleLogout = () => {
    logoutTMDB();
    toast.info('Logged out of TMDB');
  };

  const handleUpdateApp = async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    window.location.reload();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => router.replace('/?tab=home')}
          className="p-2 -ml-2 text-brand-silver hover:text-brand-cyan transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-white uppercase italic tracking-tighter">Settings</h1>
      </div>

      <div className="space-y-6">
        <section className="bg-brand-bg/50 p-4 rounded-xl blueprint-border">
          <div className="flex items-center gap-2 mb-4">
            <User className="text-brand-cyan" size={20} />
            <h2 className="text-lg font-semibold text-white">TMDB Synchronization</h2>
          </div>

          <p className="text-sm text-brand-silver mb-4">
            Sync your watchlist and history (using ratings) directly with your TMDB account.
          </p>

          {!tmdbSessionId ? (
            <button
              onClick={loginWithTMDB}
              disabled={!tempApiKey}
              className="w-full py-3 bg-brand-bg blueprint-border rounded-xl font-bold text-white hover:bg-brand-cyan/10 transition-colors disabled:opacity-50"
            >
              Login with TMDB
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-brand-bg blueprint-border rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-brand-cyan/10 rounded-full flex items-center justify-center text-brand-cyan font-bold">
                    {tmdbAccountId?.toString().slice(0, 1)}
                  </div>
                  <span className="text-sm font-medium text-white">Account ID: {tmdbAccountId}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-xs text-brand-silver">
                  {isSyncing ? 'Syncing...' : 'Connected to TMDB'}
                </span>
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="text-xs font-bold text-brand-cyan flex items-center gap-1 hover:underline disabled:opacity-50"
                >
                  <RefreshCw size={12} className={clsx(isSyncing && "animate-spin")} />
                  Sync Now
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="bg-brand-bg/50 p-4 rounded-xl blueprint-border">
          <div className="flex items-center gap-2 mb-4">
            <Key className="text-brand-cyan" size={20} />
            <h2 className="text-lg font-semibold text-white">TMDB API Key</h2>
          </div>

          <p className="text-sm text-brand-silver mb-4">
            To use this app, you need a free API key from The Movie Database.
            <a
              href="https://developer.themoviedb.org/reference/intro/getting-started"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-cyan flex items-center gap-1 mt-1 font-medium hover:underline"
            >
              Get one here <ExternalLink size={14} />
            </a>
          </p>

          <input
            type="password"
            value={tempApiKey}
            onChange={(e) => setTempApiKey(e.target.value)}
            placeholder="Enter your TMDB API key..."
            className="w-full p-3 rounded-lg bg-brand-bg blueprint-border text-white focus:ring-1 focus:ring-brand-cyan outline-none transition-all placeholder:text-brand-silver/50"
          />
        </section>

        <section className="bg-brand-bg/50 p-4 rounded-xl blueprint-border">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="text-brand-cyan" size={20} />
            <h2 className="text-lg font-semibold text-white">Content Filters</h2>
          </div>

          <div className="flex items-center justify-between">
            <div className="pr-4">
              <h3 className="text-sm font-bold text-white">VidAngel Integration</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!tempVidAngelEnabled}
                onChange={(e) => setTempVidAngelEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-brand-bg blueprint-border rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-brand-silver after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-cyan peer-checked:after:bg-brand-bg"></div>
            </label>
          </div>

          {tempVidAngelEnabled && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-[10px] text-brand-silver mb-3 italic">
                Note: To check availability, you must be logged in to your VidAngel account in this browser.
              </p>
              <a
                href="https://www.vidangel.com/login"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-bold text-amber-500 bg-amber-500/10 px-4 py-2 rounded-lg blueprint-border hover:bg-amber-500/20 transition-colors"
              >
                <ExternalLink size={12} />
                Login to VidAngel
              </a>
            </div>
          )}
        </section>

        {/* New External Player Section */}
        <section className="bg-brand-bg/50 p-4 rounded-xl blueprint-border">
          <div className="flex items-center gap-2 mb-4">
            <Play className="text-brand-cyan" size={20} />
            <h2 className="text-lg font-semibold text-white">External Player</h2>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="pr-4">
              <h3 className="text-sm font-bold text-white">Enable External Player Links</h3>
              <p className="text-xs text-brand-silver mt-1">
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
              <div className="w-11 h-6 bg-brand-bg blueprint-border rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-brand-silver after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-cyan peer-checked:after:bg-brand-bg"></div>
            </label>
          </div>

          {tempExternalPlayerEnabled && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <h3 className="text-sm font-bold text-white mb-2">Select Player</h3>
              <select
                value={tempSelectedExternalPlayerId || ''}
                onChange={(e) => setTempSelectedExternalPlayerId(e.target.value)}
                className="w-full p-3 rounded-lg bg-brand-bg blueprint-border text-white focus:ring-1 focus:ring-brand-cyan outline-none transition-all"
              >
                <option value="" disabled className="bg-brand-bg">Select an external player</option>
                {externalPlayerOptions.map((option) => (
                  <option key={option.id} value={option.id} className="bg-brand-bg">{option.name}</option>
                ))}
              </select>
            </div>
          )}
        </section>

        <button
          onClick={handleSave}
          className="w-full bg-brand-cyan text-brand-bg font-black py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-brand-cyan/90 active:scale-95 transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)] uppercase tracking-widest"
        >
          <Save size={20} />
          {saved ? 'Saved Settings!' : 'Save All Settings'}
        </button>

        <button
          onClick={() => setOnboardingCompleted(false)}
          className="w-full py-4 text-xs font-bold text-brand-silver hover:text-white transition-colors uppercase tracking-[0.2em]"
        >
          Open Setup Guide
        </button>

        <button
          onClick={handleUpdateApp}
          className="w-full py-4 text-xs font-bold text-brand-silver hover:text-white transition-colors uppercase tracking-[0.2em] flex items-center justify-center gap-2"
        >
          <Download size={14} />
          Update App
        </button>

        <section className="text-center pt-4">
          <p className="text-xs text-brand-silver/50">
            Void v1.2.1<br />
            Data provided by TMDB.
          </p>
          <p className="text-xs text-brand-silver/30 mt-2">
            v1.2.1 — Fixed 7-day check being bypassed during TMDB sync.<br />
            v1.2.0 — TV shows in watch history now automatically move to<br />
            your watchlist only when a new episode airs within 7 days.
          </p>
        </section>
      </div>
    </div>
  );
};
