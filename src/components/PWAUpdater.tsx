'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

export const PWAUpdater = () => {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registerServiceWorker = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/void/sw.js');
          
          // Check for updates on load
          if (registration.waiting) {
            showUpdateToast();
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  showUpdateToast();
                }
              });
            }
          });
        } catch (error) {
          console.error('Service worker registration failed:', error);
        }
      };

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      registerServiceWorker();
    }
  }, []);

  const showUpdateToast = () => {
    toast('New version available!', {
      description: 'The app has been updated. Refresh to apply changes.',
      duration: Infinity,
      action: {
        label: 'Refresh',
        onClick: () => {
          // Send message to skip waiting if needed, 
          // but sw.js already has skipWaiting()
          window.location.reload();
        },
      },
      icon: <RefreshCw size={18} className="text-brand-cyan" />,
    });
  };

  return null;
};
