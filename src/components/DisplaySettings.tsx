'use client';

import { useAppContext } from '@/context/AppContext';

export const DisplaySettings = () => {
  const { showTitles, setShowTitles } = useAppContext();
  return (
    <section className="rounded-xl bg-white/[0.03] blueprint-border p-4">
      <h3 className="type-title mb-1 text-white">Display</h3>
      <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-3">
        <span className="type-action text-white">Show Titles</span>
        <input type="checkbox" checked={!!showTitles} onChange={(event) => setShowTitles(event.target.checked)} className="peer sr-only" />
        <span aria-hidden="true" className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-cyan ${showTitles ? 'border-brand-cyan/50 bg-brand-cyan/25' : 'border-white/15 bg-black/25'}`}>
          <span className={`absolute top-1 h-[18px] w-[18px] rounded-full transition-all ${showTitles ? 'left-[25px] bg-brand-cyan shadow-[0_0_10px_rgba(34,211,238,0.45)]' : 'left-1 bg-brand-silver/60'}`} />
        </span>
      </label>
      <p className="text-sm text-brand-silver">Names beneath Playlist and History posters. Search always shows titles.</p>
    </section>
  );
};
