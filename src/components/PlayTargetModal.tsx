'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Play, X, ShieldCheck, ChevronLeft } from 'lucide-react';
import { ExternalPlayerOption, externalPlayerOptions } from '@/lib/types';

interface StreamPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  mediaType: 'movie' | 'tv';
  mediaId: number;
  seasonNum?: number;
  episodeNum?: number;
  /** VidAngel slug — pass only when VidAngel is enabled and available */
  vidAngelSlug?: string | null;
  externalPlayerEnabled: boolean;
  tvSupportEnabled: boolean;
  onSendToTv: (url: string, title: string) => void;
}

function buildPlayerUrl(
  player: ExternalPlayerOption,
  mediaType: 'movie' | 'tv',
  mediaId: number,
  seasonNum?: number,
  episodeNum?: number,
): string {
  if (mediaType === 'movie') {
    return player.movieUrlTemplate.replace('{TMDBID}', mediaId.toString());
  }
  if (seasonNum !== undefined && episodeNum !== undefined) {
    return player.tvUrlTemplate
      .replace('{TMDBID}', mediaId.toString())
      .replace('{season_num}', seasonNum.toString())
      .replace('{episode_num}', episodeNum.toString());
  }
  if (player.seriesUrlTemplate) {
    return player.seriesUrlTemplate.replace('{TMDBID}', mediaId.toString());
  }
  return player.movieUrlTemplate
    .replace('{TMDBID}', mediaId.toString())
    .replace('/movie/', '/tv/')
    .replace('?play=true', '');
}

export const StreamPickerModal = ({
  isOpen,
  onClose,
  title,
  mediaType,
  mediaId,
  seasonNum,
  episodeNum,
  vidAngelSlug,
  externalPlayerEnabled,
  tvSupportEnabled,
  onSendToTv,
}: StreamPickerModalProps) => {
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const handleSelect = (url: string) => {
    if (!url) return;
    if (tvSupportEnabled) {
      setPendingUrl(url);
    } else {
      window.open(url, '_blank');
      handleClose();
    }
  };

  const handleClose = () => {
    setPendingUrl(null);
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
            onClick={handleClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm glass-effect rounded-3xl p-6 shadow-2xl overflow-hidden"
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 text-brand-silver hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center">
              {!pendingUrl ? (
                /* ── Step 1: Pick a streaming site ── */
                <>
                  <h2 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">Stream On</h2>
                  <p className="text-brand-silver text-sm leading-relaxed mb-6 truncate max-w-full">{title}</p>

                  <div className="flex flex-col w-full gap-3">
                    {vidAngelUrl && (
                      <button
                        onClick={() => handleSelect(vidAngelUrl)}
                        className="w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 bg-amber-500 text-white shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                      >
                        <ShieldCheck size={20} />
                        VidAngel (Edited)
                      </button>
                    )}

                    {externalPlayerEnabled && externalPlayerOptions.map((player) => (
                      <button
                        key={player.id}
                        onClick={() => handleSelect(buildPlayerUrl(player, mediaType, mediaId, seasonNum, episodeNum))}
                        className="w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 bg-brand-bg blueprint-border text-white hover:bg-white/5 flex items-center justify-center gap-2"
                      >
                        <Play size={20} className="fill-white" />
                        {player.name}
                      </button>
                    ))}

                    <button
                      onClick={handleClose}
                      className="w-full py-4 text-xs font-bold text-brand-silver hover:text-white uppercase tracking-[0.2em] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                /* ── Step 2: Pick target (TV vs Local) ── */
                <>
                  <h2 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">Play On</h2>
                  <p className="text-brand-silver text-sm leading-relaxed mb-6 truncate max-w-full">{title}</p>

                  <div className="flex flex-col w-full gap-3">
                    <button
                      onClick={() => {
                        onSendToTv(pendingUrl, title);
                        handleClose();
                      }}
                      className="w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 bg-brand-cyan text-brand-bg shadow-lg shadow-brand-cyan/20 flex items-center justify-center gap-2"
                    >
                      <Monitor size={20} />
                      Send to TV
                    </button>

                    <button
                      onClick={() => {
                        window.open(pendingUrl, '_blank');
                        handleClose();
                      }}
                      className="w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 bg-brand-bg blueprint-border text-white hover:bg-white/5 flex items-center justify-center gap-2"
                    >
                      <Play size={20} className="fill-white" />
                      Play Local
                    </button>

                    <button
                      onClick={() => setPendingUrl(null)}
                      className="w-full py-4 text-xs font-bold text-brand-silver hover:text-white uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-1"
                    >
                      <ChevronLeft size={14} />
                      Back
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
