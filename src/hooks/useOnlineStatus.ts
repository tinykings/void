'use client';

import { useSyncExternalStore } from 'react';

const subscribe = (onStatusChange: () => void) => {
  window.addEventListener('online', onStatusChange);
  window.addEventListener('offline', onStatusChange);

  return () => {
    window.removeEventListener('online', onStatusChange);
    window.removeEventListener('offline', onStatusChange);
  };
};

const getSnapshot = () => navigator.onLine;
const getServerSnapshot = () => true;

export const useOnlineStatus = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
