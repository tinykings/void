'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';
import { FocusTrap } from '@/components/FocusTrap';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info';
}

export const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info'
}: ConfirmationModalProps) => {
  React.useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };

    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <FocusTrap active>
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmation-modal-title"
          aria-describedby="confirmation-modal-message"
          data-block-details-shortcuts="true"
        >
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm overflow-hidden rounded-xl bg-brand-bg/95 p-6 embossed-edge"
          >
            <div className="flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center mb-6 blueprint-border ${
                type === 'danger' ? 'bg-red-500/20 text-red-400' : 'bg-brand-cyan/20 text-brand-cyan'
              }`}>
                <AlertCircle size={32} />
              </div>
              
              <h2 id="confirmation-modal-title" className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">{title}</h2>
              <p id="confirmation-modal-message" className="text-brand-silver text-sm leading-relaxed mb-8">{message}</p>

              <div className="flex flex-col w-full gap-3">
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 ${
                    type === 'danger' 
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-brand-cyan text-brand-bg'
                  }`}
                >
                  {confirmText}
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-4 text-xs font-bold text-brand-silver hover:text-white uppercase tracking-[0.2em] transition-colors"
                >
                  {cancelText}
                </button>
              </div>
            </div>

            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-3 text-brand-silver hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </motion.div>
        </div>
        </FocusTrap>
      )}
    </AnimatePresence>
  );
};
