'use client';

import { Film, Gamepad2, Tv } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import type { MediaType } from '@/lib/types';

const mediaTypes: Array<{
  id: MediaType;
  label: string;
  icon: typeof Film;
}> = [
  { id: 'movie', label: 'Movies', icon: Film },
  { id: 'tv', label: 'Shows', icon: Tv },
  { id: 'game', label: 'Games', icon: Gamepad2 },
];

export const MediaTypeSettings = () => {
  const { enabledMediaTypes, setMediaTypeEnabled } = useAppContext();

  return (
    <section className="rounded-xl bg-white/[0.03] blueprint-border p-4" aria-labelledby="media-types-heading">
      <div className="mb-1">
        <h3 id="media-types-heading" className="type-title text-white">Media types</h3>
        <p className="mt-1 text-sm text-brand-silver">Choose what appears throughout Void.</p>
      </div>

      <div className="mt-3 divide-y divide-white/[0.06]">
        {mediaTypes.map(({ id, label, icon: Icon }) => {
          const enabled = enabledMediaTypes[id];

          return (
            <div key={id} className="flex min-h-14 items-center gap-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-cyan">
                <Icon size={17} />
              </div>
              <p className="type-action min-w-0 flex-1 text-white">{label}</p>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`${label} ${enabled ? 'on' : 'off'}`}
                onClick={() => setMediaTypeEnabled(id, !enabled)}
                className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan ${enabled ? 'border-brand-cyan/50 bg-brand-cyan/25' : 'border-white/15 bg-black/25'}`}
              >
                <span className={`absolute top-1 h-[18px] w-[18px] rounded-full transition-all ${enabled ? 'left-[25px] bg-brand-cyan shadow-[0_0_10px_rgba(34,211,238,0.45)]' : 'left-1 bg-brand-silver/60'}`} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
