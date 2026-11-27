'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { getImageUrl, getPersonCredits, getPersonDetails } from '@/lib/tmdb';
import { getDetailsHref } from '@/lib/media';
import { backOrHome, rememberRouteParent } from '@/lib/clientNavigation';
import { Media, PersonDetails, TmdbResult } from '@/lib/types';
import { curatePersonCredits } from '@/lib/personCredits';
import { ActorBiography } from '@/components/ActorBiography';
import { ArrowLeft, X, User } from 'lucide-react';
import { SheetDragHandle } from '@/components/SheetDragHandle';
import { FocusTrap } from '@/components/FocusTrap';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export const ActorSheet = () => {
  const isOnline = useOnlineStatus();
  const pathname = usePathname();
  const router = useRouter();
  const isPageMode = pathname.replace(/\/$/, '').endsWith('/person');
  const { activeActorMedia, closeActor, closeAllSheets, apiKey, enabledMediaTypes, openDetails } = useAppContext();
  const [actorCredits, setActorCredits] = useState<{ actorId: number; credits: TmdbResult[] } | null>(null);
  const [creditsErrorActorId, setCreditsErrorActorId] = useState<number | null>(null);
  const [creditsRetry, setCreditsRetry] = useState(0);
  const [personDetails, setPersonDetails] = useState<{ actorId: number; details: PersonDetails } | null>(null);

  const actor = activeActorMedia;

  const actorName = actor?.name || 'Unknown';

  const topCredits = useMemo(() => {
    if (!actor || actorCredits?.actorId !== actor.id) return [];
    return curatePersonCredits(actorCredits.credits, enabledMediaTypes);
  }, [actor, actorCredits, enabledMediaTypes]);

  const loading = isOnline && !!actor && !!apiKey && actorCredits?.actorId !== actor.id;

  const details = useMemo(() => {
    if (!actor || personDetails?.actorId !== actor.id) return null;
    return personDetails.details;
  }, [actor, personDetails]);

  const biography = details?.biography?.trim() || '';

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

    const controller = new AbortController();

    getPersonCredits(actor.id, apiKey, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setCreditsErrorActorId(null);
        setActorCredits({ actorId: actor.id, credits: data.cast || [] });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setCreditsErrorActorId(actor.id);
        setActorCredits({ actorId: actor.id, credits: [] });
      });

    return () => controller.abort();
  }, [actor, apiKey, isOnline, creditsRetry]);

  useEffect(() => {
    if (!isOnline || !actor || !apiKey) {
      return;
    }

    const controller = new AbortController();

    getPersonDetails(actor.id, apiKey, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setPersonDetails({ actorId: actor.id, details: data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setPersonDetails({ actorId: actor.id, details: { id: actor.id, name: actor.name, biography: '', birthday: null, place_of_birth: null, profile_path: actor.profile_path } });
      });

    return () => controller.abort();
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

                  <ActorBiography key={actor.id} biography={biography} />
                </div>
              </div>

              <section aria-label="Filmography" className="space-y-3">
              <h3 className="type-label text-brand-silver/60">Filmography</h3>
              {!isOnline && <p role="status" className="text-sm text-brand-silver">Reconnect to load this filmography.</p>}
              {creditsErrorActorId === actor.id && <div role="status" className="text-sm text-brand-silver">
                Couldn’t load filmography.
                <button type="button" disabled={!isOnline} onClick={() => {
                  setActorCredits(null);
                  setCreditsErrorActorId(null);
                  setCreditsRetry((value) => value + 1);
                }} className="type-action ml-2 min-h-11 rounded-lg px-3 text-brand-cyan hover:bg-brand-cyan/10 disabled:opacity-40">Try again</button>
              </div>}
              {!loading && isOnline && creditsErrorActorId !== actor.id && actorCredits?.actorId === actor.id && topCredits.length === 0 && <p className="text-sm text-brand-silver">No movies or shows found for your enabled media types.</p>}
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
                      aria-label={`Open details for ${media.title || media.name || 'Unknown'}`}
                      onClick={() => handleMediaOpen(media)}
                      className="group aspect-[2/3] rounded-xl overflow-hidden blueprint-border bg-brand-bg/50 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan"
                    >
                      {media.poster_path || media.backdrop_path ? (
                        <img
                          src={getImageUrl(media.poster_path || media.backdrop_path, 'w342')}
                          alt={media.title || media.name || 'Unknown'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          decoding="async"
                          loading="lazy"
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
              </section>
            </div>
          </div>

          {!isPageMode && <SheetDragHandle onClose={closeActor} />}
          </FocusTrap>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
