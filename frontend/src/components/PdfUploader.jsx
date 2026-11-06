import React, { useState, useEffect } from 'react';
import { UploadCloud, FileText, X, Settings2, Sparkles, AlertCircle, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function PdfUploader({ onExtract, isLoading }) {
  const { t, lang } = useLanguage();
  const [files, setFiles] = useState([]);
  const [hfEndpoint, setHfEndpoint] = useState("");
  const [hfToken, setHfToken] = useState("");
  const [showConfig, setShowConfig] = useState(false);

  // Extraction Progress State
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(null);

  // Dynamic progress & estimated time countdown during extraction
  useEffect(() => {
    let progressTimer = null;
    let countdownTimer = null;

    if (isLoading) {
      setProgressPercent(5);
      setCurrentStep(lang === 'as' ? "নথি বিশ্লেষক আৰু OCR প্ৰক্ৰিয়া আৰম্ভ কৰা হৈছে..." : "Initializing document parser & OCR pipeline...");

      // Estimate ~12 seconds per 1 MB of PDF, minimum 15 seconds
      const totalSizeMb = files.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024);
      const estimatedTotalSeconds = Math.max(16, Math.min(60, Math.round(totalSizeMb * 12)));
      setSecondsRemaining(estimatedTotalSeconds);

      // Countdown timer for remaining seconds
      countdownTimer = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev === null || prev <= 1) return 1;
          return prev - 1;
        });
      }, 1000);

      // Progress bar animation across phases
      const startTime = Date.now();
      progressTimer = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(94, Math.round((elapsed / estimatedTotalSeconds) * 90) + 5);
        setProgressPercent(progress);

        if (progress < 25) {
          setCurrentStep(lang === 'as' ? "PDF পৃষ্ঠা পঢ়ি মূল পাঠ্য উদ্ধাৰ কৰা হৈছে..." : "Reading PDF pages and extracting raw text layer...");
        } else if (progress < 55) {
          setCurrentStep(lang === 'as' ? "OCR আৰু পৃষ্ঠাসমূহৰ গাঁথনি চিনাক্ত কৰা হৈছে..." : "Running OCR & document layout segmentation...");
        } else if (progress < 80) {
          setCurrentStep(lang === 'as' ? "বিকল্পসমূহ চিনাক্ত কৰি ভাষাৰ বিভ্ৰান্তি আঁতৰ কৰা হৈছে..." : "Detecting multiple-choice options & removing language bleed...");
        } else {
          setCurrentStep(lang === 'as' ? "প্ৰশ্নসমূহ সজাই মক টেষ্ট পুস্তিকা প্ৰস্তুত কৰা হৈছে..." : "Structuring questions and compiling final test booklet...");
        }
      }, 500);

    } else {
      setProgressPercent(0);
      setCurrentStep("");
      setSecondsRemaining(null);
    }

    return () => {
      if (progressTimer) clearInterval(progressTimer);
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, [isLoading, files, lang]);

  const handleFileChange = (e) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"));
      setFiles(prev => [...prev, ...selected]);
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (files.length === 0) return;
    onExtract(files, hfEndpoint, hfToken, (serverProgress, serverStage) => {
      if (serverProgress !== undefined) setProgressPercent(serverProgress);
      if (serverStage) setCurrentStep(serverStage);
    });
  };

  return (
    <div className="max-w-3xl mx-auto my-8 bg-white rounded-2xl shadow-xl shadow-slate-100 border border-slate-200 overflow-hidden">
      <div className="p-8">
        <div className="text-center max-w-xl mx-auto mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mb-4">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{t('uploadTitle')}</h2>
          <p className="text-slate-500 text-sm mt-1">
            {t('uploadDesc')}
          </p>
        </div>

        {/* Drag and Drop Box */}
        <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 transition-colors rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer block">
          <UploadCloud className="w-10 h-10 text-slate-400 mb-2" />
          <span className="font-semibold text-slate-700">{t('dragDropText')}</span>
          <span className="text-xs text-slate-400 mt-1">{t('dragDropSub')}</span>
          <input
            type="file"
            multiple
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {/* Selected Files List */}
        {files.length > 0 && (
          <div className="mt-6">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              {t('selectedFiles')} ({files.length})
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                    <span className="text-xs text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    disabled={isLoading}
                    className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Extraction Progress & Countdown Bar */}
        {isLoading && (
          <div className="mt-6 p-5 bg-blue-50/70 border border-blue-200 rounded-2xl animate-fade-in text-left">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-xs font-bold text-blue-900 tracking-wide uppercase">
                  {lang === 'as' ? 'নিষ্কাশন প্ৰক্ৰিয়া চলি আছে' : 'Extraction in Progress'} ({progressPercent}%)
                </span>
              </div>
              {secondsRemaining !== null && (
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-blue-700 bg-blue-100/80 px-2.5 py-1 rounded-full">
                  <Clock className="w-3.5 h-3.5" />
                  <span>~{secondsRemaining}s {t('remaining')}</span>
                </div>
              )}
            </div>

            {/* Smooth Progress Bar */}
            <div className="w-full bg-blue-200/60 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out shadow-sm shadow-blue-500/50"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Current Stage Indicator */}
            <p className="text-xs text-blue-700 font-medium mt-2 flex items-center space-x-1.5">
              <span>{currentStep}</span>
            </p>
          </div>
        )}

        {/* Optional Hugging Face API Config Drawer */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="text-xs font-semibold text-slate-500 hover:text-blue-600 flex items-center space-x-1.5 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{showConfig ? "Hide Backend & AI Settings" : (lang === 'as' ? "কাস্টম API ছেটিংছ (ঐচ্ছিক)" : "Configure Custom API Endpoint (Optional)")}</span>
          </button>

          {showConfig && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  API Endpoint URL
                </label>
                <input
                  type="text"
                  placeholder="http://localhost:7860/extract-questions"
                  value={hfEndpoint}
                  onChange={(e) => setHfEndpoint(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  HF Token (Optional)
                </label>
                <input
                  type="password"
                  placeholder="hf_xxxxxxxxxxxxxxxxxxxx"
                  value={hfToken}
                  onChange={(e) => setHfToken(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={handleSubmit}
          disabled={files.length === 0 || isLoading}
          className={`w-full mt-6 py-3.5 px-6 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all shadow-lg ${
            files.length === 0 || isLoading
              ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 active:scale-[0.99]"
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span>{t('processingPdf')} ({progressPercent}%)...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>{t('startExtraction')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
