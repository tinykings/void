'use client';

import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { 
  User as UserIcon, 
  ShieldCheck as ShieldIcon, 
  Check as CheckIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';

export const Onboarding = () => {
  const {
    loginWithTMDB, tmdbSessionId,
    vidAngelEnabled, setVidAngelEnabled,
    setOnboardingCompleted
  } = useAppContext();

  const [step, setStep] = useState(1);

  const nextStep = () => {
    setStep(s => s + 1);
  };
  const prevStep = () => {
    setStep(s => s - 1);
  };

  // Notify when account is connected during onboarding
  useEffect(() => {
    if (tmdbSessionId && step === 1) {
      toast.success('Account connected successfully!');
    }
  }, [tmdbSessionId, step]);

  const handleFinish = () => {
    setOnboardingCompleted(true);
    toast.success('Welcome to Void!');
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
            <div className="w-16 h-16 bg-brand-cyan/10 blueprint-border rounded-2xl flex items-center justify-center mx-auto mb-8">
              <UserIcon className="text-brand-cyan" size={32} />
            </div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">Connect TMDB</h2>
            <p className="text-brand-silver text-sm leading-relaxed">
              Use your TMDB account to sync watchlist and history. Browsing data is already built into the app.
            </p>
            <div className="p-4 bg-brand-bg/50 blueprint-border rounded-xl text-left space-y-3">
              <p className="text-xs text-brand-silver font-medium">1. Tap Login with TMDB</p>
              <p className="text-xs text-brand-silver font-medium">2. Approve the app in your TMDB browser</p>
            </div>
            {!tmdbSessionId ? (
              <button
                onClick={loginWithTMDB}
                className="w-full py-4 bg-brand-bg blueprint-border text-white font-black rounded-xl hover:bg-brand-cyan/10 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                Login with TMDB
              </button>
            ) : (
              <div className="bg-green-500/10 blueprint-border p-4 rounded-xl flex items-center gap-3 justify-center text-green-400 font-bold">
                <CheckIcon size={20} /> Account Connected
              </div>
            )}
            <button 
              onClick={nextStep} 
              className="w-full py-4 bg-brand-cyan text-brand-bg hover:bg-brand-cyan/90 font-black rounded-xl transition-all uppercase tracking-widest"
            >
              {tmdbSessionId ? 'Next' : 'Skip for now'}
            </button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-amber-500/10 blueprint-border rounded-2xl flex items-center justify-center mx-auto mb-8">
              <ShieldIcon className="text-amber-400" size={32} />
            </div>
            <h2 className="text-2xl font-black text-center uppercase italic tracking-tighter text-white">Content Filters</h2>
            <p className="text-brand-silver text-center text-sm leading-relaxed">
              Would you like to see if edited versions are available on VidAngel for mature content?
            </p>
            <button
              onClick={() => {
                const newState = !vidAngelEnabled;
                setVidAngelEnabled(newState);
                toast.info(newState ? 'VidAngel integration enabled' : 'VidAngel integration disabled');
              }}
              className={clsx(
                "w-full py-4 rounded-xl font-black transition-all flex items-center justify-center gap-3 uppercase tracking-widest border",
                vidAngelEnabled 
                  ? "bg-amber-500 border-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.2)]" 
                  : "bg-transparent border-white/10 text-brand-silver hover:border-white/20"
              )}
            >
              {vidAngelEnabled ? <CheckIcon size={20} /> : null}
              {vidAngelEnabled ? 'Enabled' : 'Enable VidAngel'}
            </button>
            <div className="flex gap-3 pt-4">
              <button onClick={prevStep} className="flex-1 py-4 text-brand-silver font-bold uppercase tracking-widest text-xs">Back</button>
              <button 
                onClick={handleFinish} 
                className="flex-[2] py-4 bg-brand-cyan text-brand-bg hover:bg-brand-cyan/90 font-black rounded-xl transition-all uppercase tracking-widest"
              >
                Finish Setup
              </button>
            </div>
          </div>
        );

    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-brand-bg flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-brand-bg/50 blueprint-border rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
          <div 
            className="h-full bg-brand-cyan transition-all duration-500 ease-out shadow-[0_0_10px_#22D3EE]" 
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>
        
        {renderStep()}
        
        <div className="mt-8 text-center">
          <p className="text-[10px] font-black text-brand-silver uppercase tracking-[0.2em]">Step {step} of 2</p>
        </div>
      </div>
    </div>
  );
};
