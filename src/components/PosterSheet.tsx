'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getImageUrl } from '@/lib/tmdb';
import { X } from 'lucide-react';
import { SheetDragHandle } from '@/components/SheetDragHandle';

export const PosterSheet = () => {
  const { activePosterMedia, closePoster, closeAllSheets } = useAppContext();

  useEffect(() => {
    if (!activePosterMedia) return;
    if ('overflow' in document.body.style) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [activePosterMedia]);

  if (!activePosterMedia) return null;

  const title = activePosterMedia.title || activePosterMedia.name || 'Unknown';
  const posterSrc = activePosterMedia.poster_path ? getImageUrl(activePosterMedia.poster_path, 'original') : '';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[355] flex items-end justify-center" onClick={closeAllSheets}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-4xl h-[86vh] sm:h-[80vh] lg:h-[74vh] max-h-[92vh] bg-brand-bg/95 blueprint-border rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-brand-bg/80">
            <div className="min-w-0">
              <h2 className="text-lg font-black text-white uppercase tracking-tight leading-tight pr-2">{title}</h2>
            </div>

            <button
              onClick={closePoster}
              className="p-2 rounded-lg bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/25 shadow-[0_0_15px_rgba(34,211,238,0.1)] transition-all hover:bg-brand-cyan/20 hover:text-white hover:border-brand-cyan/40"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-24 flex items-center justify-center">
            {posterSrc ? (
              <img
                src={posterSrc}
                alt={title}
                className="max-h-full max-w-full object-contain rounded-2xl blueprint-border shadow-2xl"
                decoding="async"
              />
            ) : (
              <div className="text-brand-silver text-sm">No poster available.</div>
            )}
          </div>

          <SheetDragHandle onClose={closePoster} />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
