'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Save, ExternalLink, ArrowLeft, ShieldCheck, Download, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Media } from '@/lib/types';

type BackupItem = {
  id: number;
  title: string;
  media_type: 'movie' | 'tv';
  date_added: string;
};

interface LibraryBackup {
  version: 1;
  watchlist: BackupItem[];
  watched: BackupItem[];
  favorites: BackupItem[];
}

export const SettingsView = () => {
  const router = useRouter();
  const {
    vidAngelEnabled, setVidAngelEnabled,
    gistId, gistToken, setGistId, setGistToken, syncFromGist,
    watchlist, watched,
  } = useAppContext();

  const [tempVidAngelEnabled, setTempVidAngelEnabled] = useState(!!vidAngelEnabled);
  const [tempGistId, setTempGistId] = useState(gistId || '');
  const [tempGistToken, setTempGistToken] = useState(gistToken || '');
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);
  const hasGistSync = !!(gistId && gistToken);

  useEffect(() => {
    setTempGistId(gistId || '');
    setTempGistToken(gistToken || '');
  }, [gistId, gistToken]);

  const handleSave = () => {
    setVidAngelEnabled(tempVidAngelEnabled);
    setGistId(tempGistId.trim());
    setGistToken(tempGistToken.trim());

    if (tempGistId.trim() && tempGistToken.trim()) {
      void syncFromGist();
    }

    setSaved(true);
    toast.success('Settings saved successfully');

    setTimeout(() => {
      setSaved(false);
      router.push('/');
    }, 1000);
  };

  const handleBackupJson = () => {
    const toBackupItem = (item: Media): BackupItem => ({
      id: item.id,
      title: item.title || item.name || 'Unknown',
      media_type: item.media_type,
      date_added: item.date_added || new Date().toISOString(),
    });

    const backup: LibraryBackup = {
      version: 1,
      watchlist: watchlist.map(toBackupItem),
      watched: watched.map(toBackupItem),
      favorites: watched.filter((item) => item.isFavorite).map(toBackupItem),
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'void-library-backup.json';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success('Backup downloaded');
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

        <section className="bg-brand-bg/50 p-4 rounded-xl blueprint-border">
          <div className="flex items-center gap-2 mb-4">
            <Download className="text-brand-cyan" size={20} />
            <h2 className="text-lg font-semibold text-white">Gist Sync</h2>
          </div>

          <p className="text-sm text-brand-silver mb-4">
            Store your Gist ID and GitHub token to sync your local library across devices.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-brand-silver mb-2">Gist ID</label>
              <input
                type="text"
                value={tempGistId}
                onChange={(e) => setTempGistId(e.target.value)}
                placeholder="e.g. 8f7a9b2c3d4e5f6a7b8c9d0e"
                className="w-full p-3 rounded-lg bg-brand-bg blueprint-border text-white focus:ring-1 focus:ring-brand-cyan outline-none transition-all placeholder:text-brand-silver/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-brand-silver mb-2">GitHub Token</label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={tempGistToken}
                  onChange={(e) => setTempGistToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="w-full p-3 pr-12 rounded-lg bg-brand-bg blueprint-border text-white focus:ring-1 focus:ring-brand-cyan outline-none transition-all placeholder:text-brand-silver/50"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-silver hover:text-white"
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {hasGistSync && (
              <p className="text-[10px] text-brand-silver/70">
                Gist sync is active. Backup export is hidden.
              </p>
            )}
          </div>
        </section>

        {!hasGistSync && (
          <section className="bg-brand-bg/50 p-4 rounded-xl blueprint-border">
            <div className="flex items-center gap-2 mb-4">
              <Download className="text-brand-cyan" size={20} />
              <h2 className="text-lg font-semibold text-white">Backup Library</h2>
            </div>

            <p className="text-sm text-brand-silver mb-4">
              Download a JSON backup of your watchlist, watched items, and favorites for future restore or gist storage.
            </p>

            <button
              onClick={handleBackupJson}
              className="w-full py-3 bg-brand-bg blueprint-border rounded-xl font-bold text-white hover:bg-brand-cyan/10 transition-colors flex items-center justify-center gap-2"
            >
              <Download size={16} />
              Download JSON Backup
            </button>
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
          <p className="text-xs text-brand-silver/50">Data provided by TMDB.</p>
        </section>
      </div>
    </div>
  );
};
