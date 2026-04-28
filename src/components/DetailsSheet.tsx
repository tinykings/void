'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { getImageUrl, getMediaCredits, getContentRating, getMediaDetails, getMediaVideos } from '@/lib/tmdb';
import { CastMember, Media, Video } from '@/lib/types';
import { Bookmark, Eye, Play, X } from 'lucide-react';
import { clsx } from 'clsx';
import { ConfirmationModal } from '@/components/ConfirmationModal';

type Tab = 'overview' | 'trailers';

export const DetailsSheet = () => {
  const {
    activeDetailsMedia,
    closeDetails,
    apiKey,
    watchlistIds,
    watchedIds,
    watchedMap,
    toggleWatchlist,
    toggleWatched,
    updateMediaMetadata,
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [details, setDetails] = useState<Media | null>(null);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [contentRating, setContentRating] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [trailersLoading, setTrailersLoading] = useState(false);
  const [overviewLoadedFor, setOverviewLoadedFor] = useState<number | null>(null);
  const [trailersLoadedFor, setTrailersLoadedFor] = useState<number | null>(null);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'info';
    confirmText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info',
    confirmText: 'Confirm',
  });

  const selected = details || activeDetailsMedia;

  const mediaKey = useMemo(() => {
    if (!selected) return '';
    return `${selected.media_type}-${selected.id}`;
  }, [selected]);

  const inWatchlist = mediaKey ? watchlistIds.has(mediaKey) : false;
  const inWatched = mediaKey ? watchedIds.has(mediaKey) : false;
  const watchedItem = mediaKey ? watchedMap.get(mediaKey) : undefined;
  const isFavorite = watchedItem?.isFavorite || false;

  useEffect(() => {
    if (!activeDetailsMedia) return;
    setActiveTab('overview');
    setDetails(activeDetailsMedia);
    setCast([]);
    setVideos([]);
    setContentRating(null);
    setOverviewLoading(false);
    setTrailersLoading(false);
    setOverviewLoadedFor(null);
    setTrailersLoadedFor(null);
  }, [activeDetailsMedia?.id, activeDetailsMedia?.media_type]);

  useEffect(() => {
    if (!activeDetailsMedia || activeTab !== 'overview' || !apiKey || overviewLoadedFor === activeDetailsMedia.id) return;

    let cancelled = false;
    setOverviewLoading(true);

    Promise.all([
      getMediaDetails(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey),
      getMediaCredits(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey),
    ])
      .then(([mediaData, creditsData]) => {
        if (cancelled) return;
        setDetails(mediaData);
        setCast(creditsData.cast.slice(0, 6));
        setOverviewLoadedFor(activeDetailsMedia.id);
        updateMediaMetadata(mediaData.id, mediaData.media_type, {
          ...mediaData,
          lastChecked: Date.now(),
        });
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setOverviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeDetailsMedia, activeTab, apiKey, overviewLoadedFor, updateMediaMetadata]);

  useEffect(() => {
    if (!activeDetailsMedia || !apiKey) return;

    let cancelled = false;

    getContentRating(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey)
      .then((rating) => {
        if (!cancelled) setContentRating(rating);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [activeDetailsMedia, apiKey]);

  useEffect(() => {
    if (!activeDetailsMedia || activeTab !== 'trailers' || !apiKey || trailersLoadedFor === activeDetailsMedia.id) return;

    let cancelled = false;
    setTrailersLoading(true);

    getMediaVideos(activeDetailsMedia.id, activeDetailsMedia.media_type, apiKey)
      .then((data) => {
        if (cancelled) return;
        const trailerVideos = data.results
          .filter((video) => video.site === 'YouTube' && video.type === 'Trailer')
          .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
          .slice(0, 4);
        setVideos(trailerVideos);
        setTrailersLoadedFor(activeDetailsMedia.id);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setTrailersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeDetailsMedia, activeTab, apiKey, trailersLoadedFor]);

  useEffect(() => {
    if (!activeDetailsMedia) return;
    if ('overflow' in document.body.style) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [activeDetailsMedia]);

  const isOpen = !!activeDetailsMedia && !!selected;

  if (!isOpen || !selected) return null;

  const title = selected.title || selected.name || 'Unknown';
  const year = (selected.release_date || selected.first_air_date || '').split('-')[0];
  const handleWatchlistToggle = () => {
    if (inWatchlist) {
      setModalConfig({
        isOpen: true,
        title: 'Remove from Watchlist',
        message: `Remove \"${title}\" from your watchlist?`,
        type: 'danger',
        confirmText: 'Remove',
        onConfirm: () => toggleWatchlist(selected),
      });
      return;
    }

    toggleWatchlist(selected);
  };

  const handleWatchedToggle = () => {
    if (inWatched) {
      setModalConfig({
        isOpen: true,
        title: 'Remove from Watched',
        message: `Remove \"${title}\" from watched?`,
        type: 'danger',
        confirmText: 'Remove',
        onConfirm: () => toggleWatched(selected),
      });
      return;
    }

    toggleWatched(selected);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[350] flex items-end justify-center" onClick={closeDetails}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl h-[55vh] sm:h-[60vh] bg-brand-bg/95 blueprint-border rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-brand-bg/80">
                <div className="min-w-0">
                  <h2 className="text-lg font-black text-white uppercase italic tracking-tighter truncate">{title}</h2>
                </div>

                <button
                  onClick={closeDetails}
                  className="p-2 text-brand-silver hover:text-white transition-colors bg-white/5 rounded-full"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4">
                <div className="pt-4 grid grid-cols-[88px_1fr] gap-4 items-start">
                  <div className="aspect-[2/3] rounded-xl overflow-hidden blueprint-border bg-brand-bg/50">
                    {selected.poster_path ? (
                      <img src={getImageUrl(selected.poster_path, 'w342')} alt={title} className="w-full h-full object-cover" decoding="async" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-brand-silver text-xs text-center p-2">No poster</div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm text-brand-silver leading-relaxed line-clamp-4">
                      {selected.overview || 'No overview available.'}
                    </p>

                    <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-widest font-bold text-brand-silver">
                      <span className="px-2 py-1 rounded-full bg-white/5">{selected.media_type}</span>
                      {year && <span className="px-2 py-1 rounded-full bg-white/5">{year}</span>}
                      <span className="px-2 py-1 rounded-full bg-white/5">★ {selected.vote_average?.toFixed(1) || '0.0'}</span>
                      <span className="px-2 py-1 rounded-full bg-white/5">{contentRating || 'N/A'}</span>
                      {isFavorite && <span className="px-2 py-1 rounded-full bg-red-500/15 text-red-300">Favorite</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={handleWatchlistToggle}
                        className={clsx(
                          'flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-black uppercase tracking-widest transition-colors blueprint-border',
                          inWatchlist ? 'bg-brand-cyan/15 text-brand-cyan' : 'bg-white/5 text-white hover:bg-white/10'
                        )}
                      >
                        <Bookmark size={14} />
                        {inWatchlist ? 'In Watchlist' : 'Watchlist'}
                      </button>
                      <button
                        onClick={handleWatchedToggle}
                        className={clsx(
                          'flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-black uppercase tracking-widest transition-colors blueprint-border',
                          inWatched ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white hover:bg-white/10'
                        )}
                      >
                        <Eye size={14} />
                        {inWatched ? 'Watched' : 'Mark Watched'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 min-h-[12rem]">
                  {activeTab === 'overview' && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-brand-cyan mb-2">Cast</h3>
                        <div className="grid grid-cols-2 gap-2">
                          {overviewLoading && cast.length === 0 ? (
                            [...Array(4)].map((_, index) => (
                              <div key={index} className="flex items-center gap-3 p-2 rounded-xl bg-white/5 blueprint-border">
                                <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
                                <div className="min-w-0 flex-1 space-y-2">
                                  <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
                                  <div className="h-2 w-16 rounded bg-white/10 animate-pulse" />
                                </div>
                              </div>
                            ))
                          ) : cast.length > 0 ? (
                            cast.map((member) => (
                              <div key={member.id} className="flex items-center gap-3 p-2 rounded-xl bg-white/5 blueprint-border">
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-bg shrink-0">
                                  {member.profile_path ? (
                                    <img src={getImageUrl(member.profile_path, 'w185')} alt={member.name} className="w-full h-full object-cover" decoding="async" />
                                  ) : null}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-white truncate">{member.name}</p>
                                  <p className="text-[10px] text-brand-silver truncate">{member.character}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-brand-silver">Cast will load when available.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'trailers' && (
                    <div className="space-y-3">
                      {trailersLoading ? (
                        <div className="flex items-center justify-center py-10">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-cyan" />
                        </div>
                      ) : videos.length > 0 ? (
                        videos.map((video) => (
                          <a
                            key={video.id}
                            href={`https://www.youtube.com/watch?v=${video.key}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 blueprint-border hover:bg-white/10 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate">{video.name}</p>
                              <p className="text-[10px] text-brand-silver uppercase tracking-widest">YouTube trailer</p>
                            </div>
                            <Play className="text-brand-cyan shrink-0" size={16} />
                          </a>
                        ))
                      ) : (
                        <p className="text-sm text-brand-silver py-10 text-center">No trailers found.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-white/5 bg-brand-bg/90 backdrop-blur-md">
                <div className="grid grid-cols-2">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={clsx(
                      'py-3 text-xs font-black uppercase tracking-widest transition-colors',
                      activeTab === 'overview' ? 'text-brand-cyan bg-brand-cyan/10' : 'text-brand-silver hover:text-white'
                    )}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('trailers')}
                    className={clsx(
                      'py-3 text-xs font-black uppercase tracking-widest transition-colors',
                      activeTab === 'trailers' ? 'text-brand-cyan bg-brand-cyan/10' : 'text-brand-silver hover:text-white'
                    )}
                  >
                    Trailers
                  </button>
                </div>
              </div>
            </motion.div>

            <ConfirmationModal
              isOpen={modalConfig.isOpen}
              title={modalConfig.title}
              message={modalConfig.message}
              type={modalConfig.type}
              onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
              onConfirm={modalConfig.onConfirm}
              confirmText={modalConfig.confirmText}
            />
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
