'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { HomeView } from '@/components/views/HomeView';
import { SettingsView } from '@/components/views/SettingsView';
import { Onboarding } from '@/components/Onboarding';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';

function MainContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoaded, apiKey, onboardingCompleted } = useAppContext();
  
  const activeTab = searchParams.get('tab') || 'home';

  const setTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`/?${params.toString()}`, { scroll: false });
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!apiKey || !onboardingCompleted) {
    return <Onboarding />;
  }

  const renderView = () => {
    switch (activeTab) {
      case 'home':
        return <HomeView onGoToSettings={() => setTab('settings')} />;
      case 'settings':
        return <SettingsView />;
      default:
        return <HomeView onGoToSettings={() => setTab('settings')} />;
    }
  };

  return (
    <div className="relative overflow-hidden min-h-screen">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          {renderView()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function RootPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MainContent />
    </Suspense>
  );
}