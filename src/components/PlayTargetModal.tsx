'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X, ShieldCheck, Tv } from 'lucide-react';
import { ExternalPlayerOption, externalPlayerOptions } from '@/lib/types';
import { toast } from 'sonner';

interface StreamPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  mediaTitle: string;
  mediaType: 'movie' | 'tv';
  mediaId: number;
  seasonNum?: number;
  episodeNum?: number;
  vidAngelSlug?: string | null;
  externalPlayerEnabled: boolean;
  sendToTvEnabled: boolean;
  sendToGist: (url: string, title: string) => Promise<void>;
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
  sendToTvEnabled,
  sendToGist,
  onSelect,
}: StreamPickerModalProps) => {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [showTvChoice, setShowTvChoice] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Always start from a clean slate when the modal opens so the user
    // chooses the streaming site every time.
    setSelectedUrl(null);
    setShowTvChoice(false);
  }, [isOpen, mediaId, mediaType, seasonNum, episodeNum, mediaTitle]);

  const handleSourceSelect = (url: string) => {
    setSelectedUrl(url);
    if (sendToTvEnabled) {
      setShowTvChoice(true);
    } else {
      window.open(url, '_blank');
      onClose();
    }
  };

  const handlePlayLocal = () => {
    if (selectedUrl) {
      window.open(selectedUrl, '_blank');
      onSelect?.();
      onClose();
    }
  };

  const handlePlayOnTv = async () => {
    if (selectedUrl) {
      await sendToGist(selectedUrl, title);
      toast.success('Sent to TV');
      onSelect?.();
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedUrl(null);
    setShowTvChoice(false);
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
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">
                {showTvChoice ? 'Stream On' : 'Choose Source'}
              </h2>
              <p className="text-brand-silver text-sm leading-relaxed mb-6 truncate max-w-full">{title}</p>

              <div className="flex flex-col w-full gap-3">
                {showTvChoice ? (
                  <>
                    <button
                      onClick={handlePlayOnTv}
                      className="w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 bg-brand-cyan text-brand-bg flex items-center justify-center gap-2"
                    >
                      <Tv size={20} />
                      Play on TV
                    </button>
                    <button
                      onClick={handlePlayLocal}
                      className="w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 bg-brand-bg blueprint-border text-white hover:bg-white/5 flex items-center justify-center gap-2"
                    >
                      <Play size={20} className="fill-white" />
                      Play Local
                    </button>
                    <button
                      onClick={() => setShowTvChoice(false)}
                      className="w-full py-4 text-xs font-bold text-brand-silver hover:text-white uppercase tracking-[0.2em] transition-colors"
                    >
                      Back
                    </button>
                  </>
                ) : (
                  <>
                    {vidAngelUrl && (
                      <button
                        onClick={() => handleSourceSelect(vidAngelUrl)}
                        className="w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 bg-amber-500 text-white shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                      >
                        <ShieldCheck size={20} />
                        VidAngel (Edited)
                      </button>
                    )}

                    {externalPlayerEnabled && externalPlayerOptions.map((player) => (
                      <button
                        key={player.id}
                        onClick={() => handleSourceSelect(buildPlayerUrl(player, mediaType, mediaId, mediaTitle, seasonNum, episodeNum))}
                        className="w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 bg-brand-bg blueprint-border text-white hover:bg-white/5 flex items-center justify-center gap-2"
                      >
                        <Play size={20} className="fill-white" />
                        {player.name}
                      </button>
                    ))}
                  </>
                )}

                <button
                  onClick={handleClose}
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
