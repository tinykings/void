'use client';

import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Download, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { buildGistPayload } from '@/lib/gist';
import { MediaTypeSettings } from '@/components/MediaTypeSettings';

export const SettingsView = () => {
  const router = useRouter();
  const { gistId, gistToken, watchlist, watched, playedEpisodes } = useAppContext();
  const hasGistSync = !!(gistId && gistToken);

  const handleBackupJson = () => {
    const backup = buildGistPayload(watchlist, watched, playedEpisodes);

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
        <h1 className="type-display text-white">Settings</h1>
      </div>

      <div className="space-y-6">
        <MediaTypeSettings />

        {!hasGistSync && (
          <section className="bg-brand-bg/50 p-4 rounded-xl blueprint-border">
            <div className="flex items-center gap-2 mb-4">
              <Download className="text-brand-cyan" size={20} />
              <h2 className="type-title text-white">Backup collection</h2>
            </div>

            <p className="text-sm text-brand-silver mb-4">
              Download a JSON backup of your playlist, history, and favorites for future restore or gist storage.
            </p>

            <button
              onClick={handleBackupJson}
              className="type-action flex w-full items-center justify-center gap-2 rounded-xl bg-brand-bg py-3 text-white blueprint-border transition-colors hover:bg-brand-cyan/10"
            >
              <Download size={16} />
              Download JSON backup
            </button>
          </section>
        )}

        <section className="text-center pt-4">
          <p className="type-readout text-brand-silver/50">Data provided by TMDB and IGDB.</p>
        </section>
      </div>
    </div>
  );
};
