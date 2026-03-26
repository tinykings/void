'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Play, X, ShieldCheck } from 'lucide-react';
import { ExternalPlayerOption, externalPlayerOptions } from '@/lib/types';

interface StreamPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  mediaTitle: string;
  mediaType: 'movie' | 'tv';
  mediaId: number;
  seasonNum?: number;
  episodeNum?: number;
  /** VidAngel slug — pass only when VidAngel is enabled and available */
  vidAngelSlug?: string | null;
  externalPlayerEnabled: boolean;
  onSelect?: () => void;
}

function buildPlayerUrl(
  player: ExternalPlayerOption,
  mediaType: 'movie' | 'tv',
  mediaId: number,
  mediaTitle: string,
  seasonNum?: number,
  episodeNum?: number,
): string {
  const replaceAll = (url: string) => {
    return url
      .replace('{TMDBID}', mediaId.toString())
      .replace('{title}', encodeURIComponent(mediaTitle))
      .replace('{season_num}', seasonNum?.toString() || '')
      .replace('{episode_num}', episodeNum?.toString() || '');
  };

  if (mediaType === 'movie') {
    return replaceAll(player.movieUrlTemplate);
  }
  if (seasonNum !== undefined && episodeNum !== undefined) {
    return replaceAll(player.tvUrlTemplate);
  }
  if (player.seriesUrlTemplate) {
    return replaceAll(player.seriesUrlTemplate);
  }
  return replaceAll(player.movieUrlTemplate)
    .replace('/movie/', '/tv/')
    .replace('?play=true', '');
}

export const StreamPickerModal = ({
  isOpen,
  onClose,
  title,
  mediaTitle,
  mediaType,
  mediaId,
  seasonNum,
  episodeNum,
  vidAngelSlug,
  externalPlayerEnabled,
  onSelect,
}: StreamPickerModalProps) => {
  const handleSelect = (url: string) => {
    if (!url) return;
    window.open(url, '_blank');
    onClose();
  };

  const vidAngelUrl = vidAngelSlug
    ? `https://www.vidangel.com/${mediaType === 'movie' ? 'movie' : 'show'}/${vidAngelSlug}`
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm glass-effect rounded-3xl p-6 shadow-2xl overflow-hidden"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-brand-silver hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center">
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">Stream On</h2>
              <p className="text-brand-silver text-sm leading-relaxed mb-6 truncate max-w-full">{title}</p>

              <div className="flex flex-col w-full gap-3">
                {vidAngelUrl && (
                  <button
                    onClick={() => {
                      handleSelect(vidAngelUrl);
                      onSelect?.();
                    }}
                    className="w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 bg-amber-500 text-white shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                  >
                    <ShieldCheck size={20} />
                    VidAngel (Edited)
                  </button>
                )}

                {externalPlayerEnabled && externalPlayerOptions.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => {
                      handleSelect(buildPlayerUrl(player, mediaType, mediaId, mediaTitle, seasonNum, episodeNum));
                      onSelect?.();
                    }}
                    className="w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 bg-brand-bg blueprint-border text-white hover:bg-white/5 flex items-center justify-center gap-2"
                  >
                    <Play size={20} className="fill-white" />
                    {player.name}
                  </button>
                ))}

                <button
                  onClick={onClose}
                  className="w-full py-4 text-xs font-bold text-brand-silver hover:text-white uppercase tracking-[0.2em] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
