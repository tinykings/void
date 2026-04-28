'use client';

import { useAppContext } from '@/context/AppContext';
import { ShieldCheck as ShieldIcon, Check as CheckIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';

export const Onboarding = () => {
  const { vidAngelEnabled, setVidAngelEnabled, setOnboardingCompleted } = useAppContext();

  const handleFinish = () => {
    setOnboardingCompleted(true);
    toast.success('Welcome to Void!');
  };

  return (
    <div className="fixed inset-0 z-[200] bg-brand-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-brand-bg/50 blueprint-border rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-16 h-16 bg-amber-500/10 blueprint-border rounded-2xl flex items-center justify-center mx-auto mb-8">
            <ShieldIcon className="text-amber-400" size={32} />
          </div>

          <h2 className="text-2xl font-black text-center uppercase italic tracking-tighter text-white">Welcome</h2>
          <p className="text-brand-silver text-center text-sm leading-relaxed">
            Void uses your local library first. You can optionally enable VidAngel for edited content labels.
          </p>

          <button
            onClick={() => {
              const newState = !vidAngelEnabled;
              setVidAngelEnabled(newState);
              toast.info(newState ? 'VidAngel integration enabled' : 'VidAngel integration disabled');
            }}
            className={clsx(
              'w-full py-4 rounded-xl font-black transition-all flex items-center justify-center gap-3 uppercase tracking-widest border',
              vidAngelEnabled
                ? 'bg-amber-500 border-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                : 'bg-transparent border-white/10 text-brand-silver hover:border-white/20'
            )}
          >
            {vidAngelEnabled ? <CheckIcon size={20} /> : null}
            {vidAngelEnabled ? 'Enabled' : 'Enable VidAngel'}
          </button>

          <button
            onClick={handleFinish}
            className="w-full py-4 bg-brand-cyan text-brand-bg hover:bg-brand-cyan/90 font-black rounded-xl transition-all uppercase tracking-widest"
          >
            Finish Setup
          </button>
        </div>
      </div>
    </div>
  );
};
