'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { getImageUrl, getPersonCredits, getPersonDetails } from '@/lib/tmdb';
import { getDetailsHref } from '@/lib/media';
import { backOrHome, rememberRouteParent } from '@/lib/clientNavigation';
import { Media, PersonDetails } from '@/lib/types';
import { ArrowLeft, X, User } from 'lucide-react';
import { SheetDragHandle } from '@/components/SheetDragHandle';
import { FocusTrap } from '@/components/FocusTrap';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export const ActorSheet = () => {
  const isOnline = useOnlineStatus();
  const pathname = usePathname();
  const router = useRouter();
  const isPageMode = pathname.replace(/\/$/, '').endsWith('/person');
  const { activeActorMedia, closeActor, closeAllSheets, apiKey, openDetails } = useAppContext();
  const [actorCredits, setActorCredits] = useState<{ actorId: number; credits: Media[] } | null>(null);
  const [personDetails, setPersonDetails] = useState<{ actorId: number; details: PersonDetails } | null>(null);

  const actor = activeActorMedia;

  const actorName = actor?.name || 'Unknown';

  const topCredits = useMemo(() => {
    if (!actor || actorCredits?.actorId !== actor.id) return [];
    return actorCredits.credits.slice(0, 20);
  }, [actor, actorCredits]);

  const loading = isOnline && !!actor && !!apiKey && actorCredits?.actorId !== actor.id;

  const details = useMemo(() => {
    if (!actor || personDetails?.actorId !== actor.id) return null;
    return personDetails.details;
  }, [actor, personDetails]);

  const biography = (() => {
    const text = details?.biography?.trim() || '';
    return text.split(/\n\s*\n/)[0] || '';
  })();

  const bornLabel = (() => {
    if (!details?.birthday) return 'Unknown';

    const date = new Date(details.birthday);
    if (Number.isNaN(date.getTime())) return details.birthday;

    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${month}-${day}-${year}`;
  })();

  useEffect(() => {
    if (!isOnline || !actor || !apiKey) {
      return;
    }

    let cancelled = false;

    getPersonCredits(actor.id, apiKey)
      .then((data) => {
        if (cancelled) return;

        const deduped = data.cast
          .filter((item) => item.poster_path || item.backdrop_path)
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
  }, [actor, apiKey, isOnline]);

  useEffect(() => {
    if (!isOnline || !actor || !apiKey) {
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
  }, [actor, apiKey, isOnline]);

  useEffect(() => {
    if (!isPageMode || !actor) return;
    const previousTitle = document.title;
    document.title = `${actorName} — Void`;
    return () => { document.title = previousTitle; };
  }, [actor, actorName, isPageMode]);

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

  const handleClose = () => {
    closeActor();
    if (isPageMode) backOrHome(router, '/person');
  };

  const handleMediaOpen = (media: Media) => {
    openDetails(media);
    if (isPageMode) {
      sessionStorage.setItem('void_details_media', JSON.stringify(media));
      rememberRouteParent('/details');
      router.push(getDetailsHref(media));
    }
  };

  return (
    <AnimatePresence>
      <div className={`fixed inset-0 z-[345] flex justify-center ${isPageMode ? 'items-stretch' : 'items-end'}`} onClick={isPageMode ? undefined : closeAllSheets}>
        {!isPageMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
        )}

        <motion.div
          initial={isPageMode ? false : { y: '100%' }}
          animate={{ y: 0 }}
          exit={isPageMode ? undefined : { y: '100%' }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className={`${isPageMode ? 'page-surface' : 'sheet-surface'} will-change-transform`}
        >
          <FocusTrap active={!!actor && !isPageMode}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-brand-bg/80">
            <div className="min-w-0">
              {isPageMode ? (
                <h1 className="type-title min-w-0 truncate text-white">{actorName}</h1>
              ) : (
                <h2 className="type-title min-w-0 truncate text-white">{actorName}</h2>
              )}
            </div>

            <button
              onClick={handleClose}
              aria-label={isPageMode ? 'Back to details' : 'Close person details'}
              title={isPageMode ? 'Back to details' : 'Close person details'}
              className="rounded-lg border border-white/10 p-3 text-brand-silver transition-colors hover:border-brand-cyan/25 hover:bg-brand-cyan/10 hover:text-white"
            >
              {isPageMode ? <ArrowLeft size={20} /> : <X size={20} />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
            <div className="pt-4 space-y-4">
              <div className="rounded-xl blueprint-border bg-white/5 overflow-hidden">
                <div className="flow-root p-4 sm:p-5">
                  <div className="float-right mb-3 ml-4 aspect-square w-24 overflow-hidden rounded-xl bg-brand-bg/60 blueprint-border sm:mb-4 sm:ml-5 sm:w-32 md:w-40">
                    {actor.profile_path ? (
                      <img
                        src={getImageUrl(actor.profile_path, 'w342')}
                        alt={actorName}
                        className="h-full w-full object-cover"
                        decoding="async"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-brand-bg text-brand-silver">
                        <User size={32} />
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 text-sm">
                    <div>
                      <p className="type-label text-brand-silver/60">Born</p>
                      <p className="mt-1 font-medium text-white">{bornLabel}</p>
                    </div>
                    <p className="font-medium text-white">{details?.place_of_birth || 'Unknown'}</p>
                  </div>

                  <div className="mt-5">
                    <p className="type-label text-brand-silver/60">Biography</p>
                    <p className="mt-2 text-sm leading-relaxed text-brand-silver">
                      {biography || 'No biography available.'}
                    </p>
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
                      onClick={() => handleMediaOpen(media)}
                      className="group aspect-[2/3] rounded-xl overflow-hidden blueprint-border bg-brand-bg/50 text-left"
                    >
                      {media.poster_path || media.backdrop_path ? (
                        <img
                          src={getImageUrl(media.poster_path || media.backdrop_path, 'w342')}
                          alt={media.title || media.name || 'Unknown'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          decoding="async"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-3 text-center text-brand-silver text-xs">
                          {media.title || media.name || 'Unknown'}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {!isPageMode && <SheetDragHandle onClose={closeActor} />}
          </FocusTrap>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
