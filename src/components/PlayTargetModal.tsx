'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Play, X } from 'lucide-react';

interface PlayTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToTv: () => void;
  onPlayLocal: () => void;
  title: string;
}

export const PlayTargetModal = ({
  isOpen,
  onClose,
  onSendToTv,
  onPlayLocal,
  title,
}: PlayTargetModalProps) => {
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
            <div className="flex flex-col items-center text-center">
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">Play</h2>
              <p className="text-brand-silver text-sm leading-relaxed mb-6 truncate max-w-full">{title}</p>

              <div className="flex flex-col w-full gap-3">
                <button
                  onClick={() => {
                    onSendToTv();
                    onClose();
                  }}
                  className="w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 bg-brand-cyan text-brand-bg shadow-lg shadow-brand-cyan/20 flex items-center justify-center gap-2"
                >
                  <Monitor size={20} />
                  Send to TV
                </button>
                <button
                  onClick={() => {
                    onPlayLocal();
                    onClose();
                  }}
                  className="w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 bg-brand-bg blueprint-border text-white hover:bg-white/5 flex items-center justify-center gap-2"
                >
                  <Play size={20} className="fill-white" />
                  Play Local
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-4 text-xs font-bold text-brand-silver hover:text-white uppercase tracking-[0.2em] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>

            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-brand-silver hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
