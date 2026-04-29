'use client';

import { ChevronDown } from 'lucide-react';

type SheetDragHandleProps = {
  onClose: () => void;
};

export const SheetDragHandle = ({ onClose }: SheetDragHandleProps) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/[0.04] bg-brand-bg/40 backdrop-blur-xl px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <button
        type="button"
        onClick={onClose}
        className="flex h-11 w-full items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/25 shadow-[0_0_15px_rgba(34,211,238,0.1)] transition-all hover:bg-brand-cyan/20 hover:text-white hover:border-brand-cyan/40"
        aria-label="Close sheet"
        title="Tap to close"
      >
        <ChevronDown size={18} />
      </button>
    </div>
  );
};
