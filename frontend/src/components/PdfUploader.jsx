import React, { useState } from 'react';
import { UploadCloud, FileText, X, Settings2, Sparkles, AlertCircle } from 'lucide-react';

export default function PdfUploader({ onExtract, isLoading }) {
  const [files, setFiles] = useState([]);
  const [hfEndpoint, setHfEndpoint] = useState("");
  const [hfToken, setHfToken] = useState("");
  const [showConfig, setShowConfig] = useState(false);

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
    onExtract(files, hfEndpoint, hfToken);
  };

  return (
    <div className="max-w-3xl mx-auto my-8 bg-white rounded-2xl shadow-xl shadow-slate-100 border border-slate-200 overflow-hidden">
      <div className="p-8">
        <div className="text-center max-w-xl mx-auto mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mb-4">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Upload PDF Question Papers</h2>
          <p className="text-slate-500 text-sm mt-1">
            Upload multiple question papers. The Python/HuggingFace extraction backend will parse questions, choices, answers, and marks automatically.
          </p>
        </div>

        {/* Drag and Drop Box */}
        <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 transition-colors rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer block">
          <UploadCloud className="w-10 h-10 text-slate-400 mb-2" />
          <span className="font-semibold text-slate-700">Click or Drag & Drop PDFs here</span>
          <span className="text-xs text-slate-400 mt-1">Supports multiple .pdf files (Gate, JEE, UPSC, University exams)</span>
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
              Selected Files ({files.length})
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
                    className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
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
            <span>{showConfig ? "Hide Backend & AI Settings" : "Configure Custom HuggingFace Space URL (Optional)"}</span>
          </button>

          {showConfig && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  HuggingFace Space URL / API Endpoint
                </label>
                <input
                  type="text"
                  placeholder="https://<user>-<space>.hf.space/extract-questions (defaults to localhost:7860)"
                  value={hfEndpoint}
                  onChange={(e) => setHfEndpoint(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  HF Inference Token (Optional, for Llama 3 high accuracy)
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
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              <span>Extracting Questions with AI...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Extract Questions & Prepare Mock Test</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

