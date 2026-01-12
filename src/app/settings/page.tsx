'use client';

import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Key, Save, ExternalLink, Moon } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function SettingsPage() {
  const { apiKey, setApiKey } = useAppContext();
  const [tempKey, setTempKey] = useState(apiKey);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setApiKey(tempKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Settings</h1>
      
      <div className="space-y-6">
        <section className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <Moon className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Appearance</h2>
          </div>
          <ThemeToggle />
        </section>

        <section className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <Key className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">TMDB API Key</h2>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            To use this app, you need a free API key from The Movie Database.
            <a 
              href="https://developer.themoviedb.org/reference/intro/getting-started" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-1 font-medium hover:underline"
            >
              Get one here <ExternalLink size={14} />
            </a>
          </p>

          <input
            type="password"
            value={tempKey}
            onChange={(e) => setTempKey(e.target.value)}
            placeholder="Enter your API key..."
            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
          />

          <button
            onClick={handleSave}
            className="w-full mt-4 bg-indigo-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            <Save size={18} />
            {saved ? 'Saved!' : 'Save Key'}
          </button>
        </section>

        <section className="text-center pt-8">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            Couch v1.0.0<br />
            Data provided by TMDB.
          </p>
        </section>
      </div>
    </div>
  );
}
