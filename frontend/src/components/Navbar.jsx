import React from 'react';
import { Sparkles, BrainCircuit, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function Navbar({ onReset }) {
  const { t, lang, setLang } = useLanguage();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div 
          onClick={onReset}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-100 group-hover:scale-105 transition-transform">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
              {t('appName')}
            </h1>
            <p className="text-xs text-slate-500 font-medium">{t('tagline')}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Language Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            <Globe className="w-3.5 h-3.5 text-slate-500 mr-1.5 ml-1" />
            <button
              type="button"
              onClick={() => setLang('as')}
              className={`px-2 py-1 rounded transition-colors ${
                lang === 'as' ? 'bg-white text-indigo-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              অসমীয়া (Default)
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-2 py-1 rounded transition-colors ${
                lang === 'en' ? 'bg-white text-indigo-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
          </div>

          <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
            {t('freePlan')}
          </span>
        </div>
      </div>
    </header>
  );
}

