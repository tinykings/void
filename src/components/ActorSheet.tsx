'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { getImageUrl, getPersonCredits, getPersonDetails } from '@/lib/tmdb';
import { Media, PersonDetails } from '@/lib/types';
import { X, User } from 'lucide-react';
import { SheetDragHandle } from '@/components/SheetDragHandle';

export const ActorSheet = () => {
  const { activeActorMedia, closeActor, closeAllSheets, apiKey, openDetails } = useAppContext();
  const [actorCredits, setActorCredits] = useState<{ actorId: number; credits: Media[] } | null>(null);
  const [personDetails, setPersonDetails] = useState<{ actorId: number; details: PersonDetails } | null>(null);

  const actor = activeActorMedia;

  const actorName = actor?.name || 'Unknown';

  const topCredits = useMemo(() => {
    if (!actor || actorCredits?.actorId !== actor.id) return [];
    return actorCredits.credits.slice(0, 20);
  }, [actor, actorCredits]);

  const loading = !!actor && !!apiKey && actorCredits?.actorId !== actor.id;

  const details = useMemo(() => {
    if (!actor || personDetails?.actorId !== actor.id) return null;
    return personDetails.details;
  }, [actor, personDetails]);

  const biography = useMemo(() => {
    const text = details?.biography?.trim() || '';
    return text.split(/\n\s*\n/)[0] || '';
  }, [details?.biography]);

  const bornLabel = useMemo(() => {
    if (!details?.birthday) return 'Unknown';

    const date = new Date(details.birthday);
    if (Number.isNaN(date.getTime())) return details.birthday;

    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${month}-${day}-${year}`;
  }, [details?.birthday]);

  useEffect(() => {
    if (!actor || !apiKey) {
      return;
    }

    let cancelled = false;

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

        setActorCredits({ actorId: actor.id, credits: deduped });
      })
      .catch(() => {
        if (!cancelled) setActorCredits({ actorId: actor.id, credits: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [actor, apiKey]);

  useEffect(() => {
    if (!actor || !apiKey) {
      return;
    }

    let cancelled = false;

    getPersonDetails(actor.id, apiKey)
      .then((data) => {
        if (cancelled) return;
        setPersonDetails({ actorId: actor.id, details: data });
      })
      .catch(() => {
        if (!cancelled) setPersonDetails({ actorId: actor.id, details: { id: actor.id, name: actor.name, biography: '', birthday: null, place_of_birth: null, profile_path: actor.profile_path } });
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
      <div className="fixed inset-0 z-[345] flex items-end justify-center" onClick={closeAllSheets}>
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
              <h2 className="min-w-0 text-lg font-black text-white uppercase tracking-tight leading-tight truncate">
                {actorName}
              </h2>
            </div>

            <button
              onClick={closeActor}
              className="p-2 rounded-lg bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/25 shadow-[0_0_15px_rgba(34,211,238,0.1)] transition-all hover:bg-brand-cyan/20 hover:text-white hover:border-brand-cyan/40"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-24">
            <div className="pt-4 space-y-4">
              <div className="rounded-2xl blueprint-border bg-white/5 overflow-hidden">
                <div className="grid gap-0 md:grid-cols-[240px_1fr]">
                  <div className="bg-brand-bg/60">
                    {actor.profile_path ? (
                      <img
                        src={getImageUrl(actor.profile_path, 'original')}
                        alt={actorName}
                        className="w-full h-full min-h-72 object-cover"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-full h-72 flex items-center justify-center text-brand-silver bg-brand-bg">
                        <User size={32} />
                      </div>
                    )}
                  </div>

                  <div className="p-4 sm:p-5 space-y-4">
                    <div className="grid gap-3 text-sm">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-brand-silver/60">Born</p>
                        <p className="mt-1 text-white font-medium">{bornLabel}</p>
                      </div>
                      <div>
                        <p className="mt-1 text-white font-medium">{details?.place_of_birth || 'Unknown'}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-brand-silver/60">Biography</p>
                      <p className="mt-2 text-sm leading-relaxed text-brand-silver">
                        {biography || 'No biography available.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
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
          </div>

          <SheetDragHandle onClose={closeActor} />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
