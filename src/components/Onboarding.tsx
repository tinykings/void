'use client';

import React, { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Key, User, ShieldCheck, Play, ArrowRight, Check, ExternalLink } from 'lucide-react';
import { externalPlayerOptions } from '@/lib/types';
import { clsx } from 'clsx';

export const Onboarding = () => {
  const { 
    apiKey, setApiKey, 
    loginWithTMDB, tmdbSessionId, 
    vidAngelEnabled, setVidAngelEnabled,
    externalPlayerEnabled, toggleExternalPlayerEnabled,
    selectedExternalPlayer, setSelectedExternalPlayerId,
    setOnboardingCompleted 
  } = useAppContext();

  const [step, setStep] = useState(1);
  const [tempApiKey, setTempApiKey] = useState(apiKey);

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center mx-auto mb-8">
              <Key className="text-indigo-400" size={32} />
            </div>
            <h2 className="text-2xl font-black text-center uppercase italic italic tracking-tighter">TMDB API Key</h2>
            <p className="text-gray-400 text-center text-sm leading-relaxed">
              To browse and track your movies, you need a free API key from The Movie Database.
            </p>
            <div className="space-y-4">
              <input
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="Paste your API key here..."
                className="w-full p-4 rounded-xl bg-gray-800 border border-gray-700 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-600"
              />
              <a
                href="https://developer.themoviedb.org/reference/intro/getting-started"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-400 hover:underline"
              >
                Don't have a key? Get one here <ExternalLink size={12} />
              </a>
            </div>
            <button
              onClick={() => {
                setApiKey(tempApiKey);
                nextStep();
              }}
              disabled={!tempApiKey}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg shadow-indigo-900/20"
            >
              Continue <ArrowRight size={18} />
            </button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center mx-auto mb-8">
              <User className="text-indigo-400" size={32} />
            </div>
            <h2 className="text-2xl font-black text-center uppercase italic tracking-tighter">Connect Account</h2>
            <p className="text-gray-400 text-center text-sm leading-relaxed">
              Sync your watchlist and history across all your devices using your TMDB account.
            </p>
            {!tmdbSessionId ? (
              <button
                onClick={loginWithTMDB}
                className="w-full py-4 bg-white text-gray-900 font-black rounded-xl hover:bg-gray-100 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                Login with TMDB
              </button>
            ) : (
              <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center gap-3 justify-center text-green-400 font-bold">
                <Check size={20} /> Account Connected
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={prevStep} className="flex-1 py-4 text-gray-500 font-bold uppercase tracking-widest text-xs">Back</button>
              <button 
                onClick={nextStep} 
                className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-all uppercase tracking-widest"
              >
                {tmdbSessionId ? 'Next' : 'Skip for now'}
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-8">
              <ShieldCheck className="text-amber-400" size={32} />
            </div>
            <h2 className="text-2xl font-black text-center uppercase italic tracking-tighter">Content Filters</h2>
            <p className="text-gray-400 text-center text-sm leading-relaxed">
              Would you like to see if edited versions are available on VidAngel for mature content?
            </p>
            <button
              onClick={() => setVidAngelEnabled(!vidAngelEnabled)}
              className={clsx(
                "w-full py-4 rounded-xl font-black transition-all flex items-center justify-center gap-3 uppercase tracking-widest border-2",
                vidAngelEnabled 
                  ? "bg-amber-500 border-amber-500 text-white" 
                  : "bg-transparent border-gray-700 text-gray-400 hover:border-gray-600"
              )}
            >
              {vidAngelEnabled ? <Check size={20} /> : null}
              {vidAngelEnabled ? 'Enabled' : 'Enable VidAngel'}
            </button>
            <div className="flex gap-3 pt-4">
              <button onClick={prevStep} className="flex-1 py-4 text-gray-500 font-bold uppercase tracking-widest text-xs">Back</button>
              <button 
                onClick={nextStep} 
                className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-all uppercase tracking-widest"
              >
                Continue
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-rose-600/20 rounded-2xl flex items-center justify-center mx-auto mb-8">
              <Play className="text-rose-400" size={32} />
            </div>
            <h2 className="text-2xl font-black text-center uppercase italic tracking-tighter">External Player</h2>
            <p className="text-gray-400 text-center text-sm leading-relaxed">
              Optionally enable direct play links using third-party streaming providers.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={toggleExternalPlayerEnabled}
                className={clsx(
                  "w-full py-4 rounded-xl font-black transition-all flex items-center justify-center gap-3 uppercase tracking-widest border-2",
                  externalPlayerEnabled 
                    ? "bg-rose-600 border-rose-600 text-white" 
                    : "bg-transparent border-gray-700 text-gray-400 hover:border-gray-600"
                )}
              >
                {externalPlayerEnabled ? <Check size={20} /> : null}
                {externalPlayerEnabled ? 'Enabled' : 'Enable Player Links'}
              </button>

              {externalPlayerEnabled && (
                <select
                  value={selectedExternalPlayer?.id || ''}
                  onChange={(e) => setSelectedExternalPlayerId(e.target.value)}
                  className="w-full p-4 rounded-xl bg-gray-800 border border-gray-700 text-white focus:ring-2 focus:ring-rose-500 outline-none transition-all font-bold text-sm"
                >
                  <option value="" disabled>Select a provider</option>
                  {externalPlayerOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={prevStep} className="flex-1 py-4 text-gray-500 font-bold uppercase tracking-widest text-xs">Back</button>
              <button 
                onClick={() => setOnboardingCompleted(true)} 
                className="flex-[2] py-4 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl transition-all uppercase tracking-widest shadow-lg shadow-green-900/20"
              >
                Finish Setup
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 rounded-3xl p-8 border border-gray-800 shadow-2xl relative overflow-hidden">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800">
          <div 
            className="h-full bg-indigo-600 transition-all duration-500 ease-out" 
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
        
        {renderStep()}
        
        <div className="mt-8 text-center">
          <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">Step {step} of 4</p>
        </div>
      </div>
    </div>
  );
};
