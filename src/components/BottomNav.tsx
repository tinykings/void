'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, List, CheckCircle, Settings } from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: List, label: 'Watchlist', href: '/watchlist' },
  { icon: CheckCircle, label: 'Watched', href: '/watched' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

export const BottomNav = () => {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-safe shadow-lg z-50 transition-colors duration-300">
      <div className="flex justify-around items-center h-16">
        {navItems.map(({ icon: Icon, label, href }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors',
                isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-indigo-400 dark:text-gray-400 dark:hover:text-indigo-300'
              )}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
