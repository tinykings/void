'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { LibraryBackupSettings } from '@/components/LibraryBackupSettings';

export const SettingsView = () => {
  const router = useRouter();
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pt-4">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.replace('/?tab=home')} aria-label="Back to collection" className="p-2 -ml-2 text-brand-silver hover:text-brand-cyan transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="type-display text-white">Settings</h1>
      </div>
      <div className="space-y-6">
        <LibraryBackupSettings />
        <section className="text-center pt-4">
          <p className="type-readout text-brand-silver/50">Data provided by TMDB.</p>
        </section>
      </div>
    </div>
  );
};
