'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User } from 'lucide-react';
import { Media, CastMember } from '@/lib/types';
import { MediaCard } from './MediaCard';
import { getImageUrl } from '@/lib/tmdb';

interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  actor: CastMember | null;
  credits: Media[];
  loading: boolean;
}

export const CreditsModal = ({
  isOpen,
  onClose,
  actor,
  credits,
  loading
}: CreditsModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="relative w-full max-w-4xl h-[90vh] sm:h-[80vh] bg-brand-bg/95 blueprint-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-brand-bg/50 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-brand-bg blueprint-border shrink-0">
                  {actor?.profile_path ? (
                    <img 
                      src={getImageUrl(actor.profile_path, 'w185')} 
                      alt={actor.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-brand-silver">
                      <User size={24} />
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase italic tracking-tighter leading-none">{actor?.name}</h2>
                  <p className="text-brand-silver text-xs font-bold uppercase tracking-widest mt-1">Known For</p>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 text-brand-silver hover:text-white transition-colors bg-white/5 rounded-full"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-cyan shadow-[0_0_15px_rgba(34,211,238,0.2)]"></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {credits.map((media) => (
                    <MediaCard 
                      key={`${media.media_type}-${media.id}`} 
                      media={media} 
                      showActions={false}
                      onClick={onClose}
                    />
                  ))}
                </div>
              )}
              {!loading && credits.length === 0 && (
                <div className="text-center py-20 text-brand-silver">
                  No other works found.
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
