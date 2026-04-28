'use client';

import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Download, ArrowLeft } from 'lucide-react';
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
  const { gistId, gistToken, watchlist, watched } = useAppContext();
  const hasGistSync = !!(gistId && gistToken);

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

        <section className="text-center pt-4">
          <p className="text-xs text-brand-silver/50">Data provided by TMDB.</p>
        </section>
      </div>
    </div>
  );
};
