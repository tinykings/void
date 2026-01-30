'use client';

import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Key, User, ShieldCheck, Play, ArrowRight, Check, ExternalLink } from 'lucide-react';
import { externalPlayerOptions } from '@/lib/types';
import { validateApiKey } from '@/lib/tmdb';
import { clsx } from 'clsx';
import { toast } from 'sonner';

// Re-using icon names but they might be imported from lucide-react in actual code
import { 
  Key as KeyIcon, 
  User as UserIcon, 
  ShieldCheck as ShieldIcon, 
  Play as PlayIcon,
  ArrowRight as ArrowIcon,
  Check as CheckIcon,
  ExternalLink as LinkIcon,
  Loader2
} from 'lucide-react';

export const Onboarding = () => {
  const { 
    apiKey, setApiKey, 
    loginWithTMDB, tmdbSessionId, 
    vidAngelEnabled, setVidAngelEnabled,
    externalPlayerEnabled, toggleExternalPlayerEnabled,
    selectedExternalPlayer, setSelectedExternalPlayerId,
    setOnboardingCompleted 
  } = useAppContext();

  const [step, setStep] = useState(apiKey ? 2 : 1);
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextStep = () => {
    setError(null);
    setStep(s => s + 1);
  };
  const prevStep = () => {
    setError(null);
    setStep(s => s - 1);
  };

  const handleValidateKey = async () => {
    setIsValidating(true);
    setError(null);
    const isValid = await validateApiKey(tempApiKey);
    if (isValid) {
      setApiKey(tempApiKey);
      toast.success('API Key validated');
      nextStep();
    } else {
      setError('Invalid API Key. Please check and try again.');
      toast.error('Validation failed');
    }
    setIsValidating(false);
  };

  // Notify when account is connected during onboarding
  useEffect(() => {
    if (tmdbSessionId && step === 2) {
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
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-brand-cyan/10 blueprint-border rounded-2xl flex items-center justify-center mx-auto mb-8">
              <KeyIcon className="text-brand-cyan" size={32} />
            </div>
            <h2 className="text-2xl font-black text-center uppercase italic tracking-tighter text-white">TMDB API Key</h2>
            <p className="text-brand-silver text-center text-sm leading-relaxed">
              To browse and track your movies, you need a free API key from The Movie Database.
            </p>
            <div className="space-y-4">
              <input
                type="password"
                value={tempApiKey}
                onChange={(e) => {
                  setTempApiKey(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Paste your API key here..."
                className={clsx(
                  "w-full p-4 rounded-xl bg-brand-bg blueprint-border text-white focus:ring-1 focus:ring-brand-cyan outline-none transition-all placeholder:text-brand-silver/50",
                  error ? "border-red-500" : ""
                )}
              />
              {error && (
                <p className="text-red-500 text-xs font-bold text-center animate-in fade-in slide-in-from-top-1 duration-300">
                  {error}
                </p>
              )}
              <a
                href="https://developer.themoviedb.org/reference/intro/getting-started"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-xs font-bold text-brand-cyan hover:underline"
              >
                Don't have a key? Get one here <LinkIcon size={12} />
              </a>
            </div>
            <button
              onClick={handleValidateKey}
              disabled={!tempApiKey || isValidating}
              className="w-full py-4 bg-brand-cyan text-brand-bg hover:bg-brand-cyan/90 disabled:opacity-50 font-black rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-[0_0_20px_rgba(34,211,238,0.2)]"
            >
              {isValidating ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Validating...
                </>
              ) : (
                <>
                  Continue <ArrowIcon size={18} />
                </>
              )}
            </button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-brand-cyan/10 blueprint-border rounded-2xl flex items-center justify-center mx-auto mb-8">
              <UserIcon className="text-brand-cyan" size={32} />
            </div>
            <h2 className="text-2xl font-black text-center uppercase italic tracking-tighter text-white">Connect Account</h2>
            <p className="text-brand-silver text-center text-sm leading-relaxed">
              Sync your watchlist and history across all your devices using your TMDB account.
            </p>
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
            <div className="flex gap-3">
              <button onClick={prevStep} className="flex-1 py-4 text-brand-silver font-bold uppercase tracking-widest text-xs">Back</button>
              <button 
                onClick={nextStep} 
                className="flex-[2] py-4 bg-brand-cyan text-brand-bg hover:bg-brand-cyan/90 font-black rounded-xl transition-all uppercase tracking-widest"
              >
                {tmdbSessionId ? 'Next' : 'Skip for now'}
              </button>
            </div>
          </div>
        );

      case 3:
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
                onClick={nextStep} 
                className="flex-[2] py-4 bg-brand-cyan text-brand-bg hover:bg-brand-cyan/90 font-black rounded-xl transition-all uppercase tracking-widest"
              >
                Continue
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-rose-500/10 blueprint-border rounded-2xl flex items-center justify-center mx-auto mb-8">
              <PlayIcon className="text-rose-400" size={32} />
            </div>
            <h2 className="text-2xl font-black text-center uppercase italic tracking-tighter text-white">External Player</h2>
            <p className="text-brand-silver text-center text-sm leading-relaxed">
              Optionally enable direct play links using third-party streaming providers.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  toggleExternalPlayerEnabled();
                  // Note: toggleExternalPlayerEnabled logic handles selecting first provider if none selected
                }}
                className={clsx(
                  "w-full py-4 rounded-xl font-black transition-all flex items-center justify-center gap-3 uppercase tracking-widest border",
                  externalPlayerEnabled 
                    ? "bg-rose-600 border-rose-600 text-white shadow-[0_0_20px_rgba(225,29,72,0.2)]" 
                    : "bg-transparent border-white/10 text-brand-silver hover:border-white/20"
                )}
              >
                {externalPlayerEnabled ? <CheckIcon size={20} /> : null}
                {externalPlayerEnabled ? 'Enabled' : 'Enable Player Links'}
              </button>

              {externalPlayerEnabled && (
                <select
                  value={selectedExternalPlayer?.id || ''}
                  onChange={(e) => {
                    setSelectedExternalPlayerId(e.target.value);
                    const name = externalPlayerOptions.find(o => o.id === e.target.value)?.name;
                    toast.info(`Player set to ${name}`);
                  }}
                  className="w-full p-4 rounded-xl bg-brand-bg blueprint-border text-white focus:ring-1 focus:ring-brand-cyan outline-none transition-all font-bold text-sm"
                >
                  <option value="" disabled className="bg-brand-bg">Select a provider</option>
                  {externalPlayerOptions.map(opt => (
                    <option key={opt.id} value={opt.id} className="bg-brand-bg">{opt.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={prevStep} className="flex-1 py-4 text-brand-silver font-bold uppercase tracking-widest text-xs">Back</button>
              <button 
                onClick={handleFinish} 
                className="flex-[2] py-4 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(22,163,74,0.2)]"
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
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
        
        {renderStep()}
        
        <div className="mt-8 text-center">
          <p className="text-[10px] font-black text-brand-silver uppercase tracking-[0.2em]">Step {step} of 4</p>
        </div>
      </div>
    </div>
  );
};