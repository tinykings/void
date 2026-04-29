'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { getImageUrl, getPersonCredits } from '@/lib/tmdb';
import { Media } from '@/lib/types';
import { X, User } from 'lucide-react';

export const ActorSheet = () => {
  const { activeActorMedia, closeActor, apiKey, openDetails } = useAppContext();
  const [credits, setCredits] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);

  const actor = activeActorMedia;

  const actorName = actor?.name || 'Unknown';

  const topCredits = useMemo(() => credits.slice(0, 20), [credits]);

  useEffect(() => {
    if (!actor || !apiKey) {
      setCredits([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getPersonCredits(actor.id, apiKey)
      .then((data) => {
        if (cancelled) return;

        const deduped = data.cast
          .filter((item) => item.poster_path)
          .filter((item) => !(item.genre_ids || []).includes(10767))
          .sort((a, b) => {
            const countDiff = (b.vote_count || 0) - (a.vote_count || 0);
            if (countDiff !== 0) return countDiff;

            return (b.popularity || 0) - (a.popularity || 0);
          })
          .reduce((acc, item) => {
            const key = `${item.media_type}-${item.id}`;
            if (acc.some((existing) => `${existing.media_type}-${existing.id}` === key)) return acc;

            acc.push({
              ...item,
              title: item.title,
              name: item.name,
            } as Media);
            return acc;
          }, [] as Media[])
          .slice(0, 20);

        setCredits(deduped);
      })
      .catch(() => {
        if (!cancelled) setCredits([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [actor, apiKey]);

  useEffect(() => {
    if (!actor) return;
    if ('overflow' in document.body.style) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [actor]);

  if (!actor) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[345] flex items-end justify-center" onClick={closeActor}>
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
            <div className="min-w-0 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-bg blueprint-border shrink-0">
                {actor.profile_path ? (
                  <img src={getImageUrl(actor.profile_path, 'w185')} alt={actorName} className="w-full h-full object-cover" decoding="async" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-brand-silver">
                    <User size={20} />
                  </div>
                )}
              </div>
              <h2 className="min-w-0 text-lg font-black text-white uppercase tracking-tight leading-tight truncate">
                {actorName}
              </h2>
            </div>

            <button
              onClick={closeActor}
              className="p-2 text-brand-silver hover:text-white transition-colors bg-white/5 rounded-full"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4">
            <div className="pt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {loading ? (
                [...Array(20)].map((_, index) => (
                  <div key={index} className="aspect-[2/3] rounded-xl bg-white/10 animate-pulse blueprint-border" />
                ))
              ) : (
                topCredits.map((media) => (
                  <button
                    key={`${media.media_type}-${media.id}`}
                    type="button"
                    onClick={() => openDetails(media)}
                    className="group aspect-[2/3] rounded-xl overflow-hidden blueprint-border bg-brand-bg/50 text-left"
                  >
                    {media.poster_path ? (
                      <img
                        src={getImageUrl(media.poster_path, 'w342')}
                        alt={media.title || media.name || 'Unknown'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        decoding="async"
                      />
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
