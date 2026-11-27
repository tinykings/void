'use client';

import { Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useAppContext } from '@/context/AppContext';
import { buildGistPayload } from '@/lib/gist';
import { buildLibraryText } from '@/lib/libraryExport';

const downloadFile = (content: string, type: string, filename: string) => {
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([content], { type }));
  try {
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Let the browser consume the object URL before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
};

export const LibraryBackupSettings = () => {
  const { watchlist, watched, playedEpisodes } = useAppContext();
  const legacyCount = [...watchlist, ...watched].filter((item) => item.media_type === 'game').length;
  const download = (format: 'text' | 'json') => {
    try {
      if (format === 'text') {
        downloadFile(buildLibraryText(watchlist, watched), 'text/plain;charset=utf-8', 'void-library.txt');
      } else {
        const payload = buildGistPayload(watchlist, watched, playedEpisodes);
        downloadFile(JSON.stringify(payload, null, 2), 'application/json', 'void-library-backup.json');
      }
      toast.success(format === 'text' ? 'Library exported' : 'Backup downloaded');
    } catch {
      toast.error('Could not prepare the download. Please try again.');
    }
  };
  return (
    <section className="space-y-3 rounded-xl bg-white/[0.03] blueprint-border p-4">
      <h3 className="type-title text-white">Export & backup</h3>
      <p className="text-sm text-brand-silver">Save a readable text copy with Favorites first, or download a full JSON backup. Both include hidden media types.</p>
      {legacyCount > 0 && <p className="text-sm text-brand-silver" role="status">This version tracks movies and shows only. Your {legacyCount} previously saved {legacyCount === 1 ? 'game is' : 'games are'} hidden, not deleted, and {legacyCount === 1 ? 'remains' : 'remain'} in Gist sync and both downloads.</p>}
      <button type="button" onClick={() => download('text')} className="type-action flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-bg px-4 py-3 text-white blueprint-border transition-colors hover:bg-brand-cyan/10">
        <FileText size={16} />Export library as text
      </button>
      <button type="button" onClick={() => download('json')} className="type-action flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-bg px-4 py-3 text-white blueprint-border transition-colors hover:bg-brand-cyan/10">
        <Download size={16} />Download JSON backup
      </button>
    </section>
  );
};
