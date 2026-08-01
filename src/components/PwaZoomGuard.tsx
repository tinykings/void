'use client';

import { useEffect } from 'react';

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

export function PwaZoomGuard() {
  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!viewport) return;

    const browserViewport = viewport.content;
    const updateZoomPolicy = () => {
      const isStandalone = displayMode.matches || Boolean((navigator as NavigatorWithStandalone).standalone);
      document.documentElement.toggleAttribute('data-pwa', isStandalone);
      viewport.content = isStandalone
        ? 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
        : browserViewport;
    };

    updateZoomPolicy();
    displayMode.addEventListener('change', updateZoomPolicy);
    return () => {
      displayMode.removeEventListener('change', updateZoomPolicy);
      document.documentElement.removeAttribute('data-pwa');
      viewport.content = browserViewport;
    };
  }, []);

  return null;
}
