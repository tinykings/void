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
        <div className="fixed inset-0 z-[400] flex items-end justify-center">
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
            className="sheet-surface"
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
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-brand-silver">
                      <User size={24} />
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="type-title text-white">{actor?.name}</h2>
                  <p className="type-label mt-1 text-brand-silver">Known for</p>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="rounded-lg border border-white/10 p-3 text-brand-silver transition-colors hover:border-brand-cyan/25 hover:bg-brand-cyan/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="custom-scrollbar flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:p-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-brand-cyan"></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {credits.map((media) => (
                    <MediaCard 
                      key={`${media.media_type}-${media.id}`} 
                      media={media} 
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
