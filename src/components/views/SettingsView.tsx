'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Key, Save, ExternalLink, RefreshCw, ArrowLeft, ShieldCheck, Play, User, LogOut, Tv } from 'lucide-react';
import { clsx } from 'clsx';
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
    sendToTvEnabled, setSendToTvEnabled,
    gistId, setGistId,
    gistToken, setGistToken,
  } = useAppContext();

  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [tempVidAngelEnabled, setTempVidAngelEnabled] = useState(!!vidAngelEnabled);
  const [tempExternalPlayerEnabled, setTempExternalPlayerEnabled] = useState(!!externalPlayerEnabled);
  const [tempSendToTvEnabled, setTempSendToTvEnabled] = useState(!!sendToTvEnabled);
  const [tempGistId, setTempGistId] = useState(gistId || '');
  const [tempGistToken, setTempGistToken] = useState(gistToken || '');
  const [showToken, setShowToken] = useState(false);

  const [saved, setSaved] = useState(false);

  // We'll use a key on the component from the parent to reset it if needed, 
  // or just rely on initial state since settings are usually edited once per visit.
  // Removing the useEffect that was causing the lint error.

  const handleSave = () => {
    setApiKey(tempApiKey);
    setVidAngelEnabled(tempVidAngelEnabled);
    if (tempExternalPlayerEnabled !== externalPlayerEnabled) {
      toggleExternalPlayerEnabled();
    }
    setSendToTvEnabled(tempSendToTvEnabled);
    setGistId(tempGistId);
    setGistToken(tempGistToken);
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pt-4">
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
            Log in to your TMDB account and approve the 3rd party app request to sync your watchlist and history across all your devices.
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

        {/* External Player Section */}
        <section className="bg-brand-bg/50 p-4 rounded-xl blueprint-border">
          <div className="flex items-center gap-2 mb-4">
            <Play className="text-brand-cyan" size={20} />
            <h2 className="text-lg font-semibold text-white">External Player</h2>
          </div>

          <div className="flex items-center justify-between">
            <div className="pr-4">
              <h3 className="text-sm font-bold text-white">Enable Streaming</h3>
              <p className="text-xs text-brand-silver mt-1">
                Show a &quot;Play&quot; button on media pages. You&apos;ll choose the streaming site each time you play.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!tempExternalPlayerEnabled}
                onChange={(e) => setTempExternalPlayerEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-brand-bg blueprint-border rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-brand-silver after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-cyan peer-checked:after:bg-brand-bg"></div>
            </label>
          </div>
        </section>

        {tempExternalPlayerEnabled && (
        <section className="bg-brand-bg/50 p-4 rounded-xl blueprint-border">
          <div className="flex items-center gap-2 mb-4">
            <Tv className="text-brand-cyan" size={20} />
            <h2 className="text-lg font-semibold text-white">Send to TV</h2>
          </div>

          <div className="flex items-center justify-between">
            <div className="pr-4">
              <h3 className="text-sm font-bold text-white">Enable Send to TV</h3>
              <p className="text-xs text-brand-silver mt-1">
                Send media to play on your TV via a GitHub Gist.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!tempSendToTvEnabled}
                onChange={(e) => setTempSendToTvEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-brand-bg blueprint-border rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-brand-silver after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-cyan peer-checked:after:bg-brand-bg"></div>
            </label>
          </div>

          {tempSendToTvEnabled && (
            <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-brand-silver mb-2">Gist ID</label>
                <input
                  type="text"
                  value={tempGistId}
                  onChange={(e) => setTempGistId(e.target.value)}
                  placeholder="e.g., 8f7a9b2c3d4e5f6a7b8c9d0e"
                  className="w-full p-3 rounded-lg bg-brand-bg blueprint-border text-white focus:ring-1 focus:ring-brand-cyan outline-none transition-all placeholder:text-brand-silver/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-silver mb-2">Personal Access Token</label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={tempGistToken}
                    onChange={(e) => setTempGistToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx"
                    className="w-full p-3 rounded-lg bg-brand-bg blueprint-border text-white focus:ring-1 focus:ring-brand-cyan outline-none transition-all placeholder:text-brand-silver/50 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-silver hover:text-white"
                  >
                    {showToken ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-brand-silver/70">
                Create a public gist on GitHub and paste the ID here. Generate a token with &quot;gist&quot; scope at{' '}
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-cyan hover:underline"
                >
                  github.com/settings/tokens
                </a>
              </p>
            </div>
          )}
        </section>
        )}

        <button
          onClick={handleSave}
          className="w-full bg-brand-cyan text-brand-bg font-black py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-brand-cyan/90 active:scale-95 transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)] uppercase tracking-widest"
        >
          <Save size={20} />
          {saved ? 'Saved Settings!' : 'Save All Settings'}
        </button>

        <section className="text-center pt-4">
          <p className="text-xs text-brand-silver/50">
            Data provided by TMDB.
          </p>
        </section>
      </div>
    </div>
  );
};
