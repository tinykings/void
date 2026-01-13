'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Home, List, CheckCircle, Settings } from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { icon: Home, label: 'Home', tab: 'home' },
  { icon: List, label: 'Watchlist', tab: 'watchlist' },
  { icon: CheckCircle, label: 'Watched', tab: 'watched' },
  { icon: Settings, label: 'Settings', tab: 'settings' },
];

export const BottomNav = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'home';

  const handleNav = (tab: string) => {
    router.replace(`/?tab=${tab}`, { scroll: false });
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-safe shadow-lg z-50 transition-colors duration-300">
      <div className="flex justify-around items-center h-16">
        {navItems.map(({ icon: Icon, label, tab }) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => handleNav(tab)}
              className={clsx(
                'flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors outline-none',
                isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 active:text-indigo-400 dark:text-gray-400 dark:active:text-indigo-300'
              )}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className={clsx('transition-transform', isActive && 'scale-110')} />
              <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
