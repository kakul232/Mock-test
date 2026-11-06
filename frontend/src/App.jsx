import React, { useState } from 'react';
import Navbar from './components/Navbar';
import PdfUploader from './components/PdfUploader';
import TestConfigEditor from './components/TestConfigEditor';
import ExamInterface from './components/ExamInterface';
import ExamResults from './components/ExamResults';
import { extractQuestionsFromPDFs, startExtractionJob, checkExtractionProgress } from './services/api';

export default function App() {
  // Navigation Steps: 'upload' | 'config' | 'exam' | 'results'
  const [step, setStep] = useState('upload');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [testConfig, setTestConfig] = useState(null);
  const [examResult, setExamResult] = useState(null);

  // 1. Handle PDF Extraction with Progress Tracking
  const handleExtractQuestions = async (files, hfEndpoint, hfToken, onProgressUpdate) => {
    setLoading(true);
    try {
      // Try asynchronous extraction with real progress polling first
      try {
        const startRes = await startExtractionJob(files, hfEndpoint);
        if (startRes && startRes.jobId) {
          const jobId = startRes.jobId;
          let isDone = false;
          while (!isDone) {
            await new Promise(r => setTimeout(r, 800));
            const statusData = await checkExtractionProgress(jobId, hfEndpoint);
            if (onProgressUpdate) {
              onProgressUpdate(statusData.progress, statusData.currentStage);
            }
            if (statusData.status === 'completed') {
              isDone = true;
              setQuestions(statusData.questions || []);
              setStep('config');
              return;
            } else if (statusData.status === 'failed') {
              throw new Error(statusData.error || 'Extraction failed.');
            }
          }
        }
      } catch (pollErr) {
        console.warn("Async polling fallback to direct extraction:", pollErr);
      }

      // Fallback to direct synchronous extraction
      const data = await extractQuestionsFromPDFs(files, hfEndpoint, hfToken);
      if (data && data.questions) {
        setQuestions(data.questions);
        setStep('config');
      }
    } catch (err) {
      alert("Failed to extract questions: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Start Exam
  const handleStartTest = (config) => {
    setTestConfig(config);
    setStep('exam');
  };

  // 3. Finish Exam
  const handleFinishExam = (results) => {
    setExamResult(results);
    setStep('results');
  };

  // Reset to initial
  const handleReset = () => {
    if (step === 'exam') {
      if (!confirm("Are you sure you want to exit the exam? Your current progress will be lost.")) {
        return;
      }
    }
    setStep('upload');
    setQuestions([]);
    setTestConfig(null);
    setExamResult(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {step !== 'exam' && <Navbar onReset={handleReset} />}

      <main className="flex-1 pb-12">
        {step === 'upload' && (
          <PdfUploader
            onExtract={handleExtractQuestions}
            isLoading={loading}
          />
        )}

        {step === 'config' && (
          <TestConfigEditor
            questions={questions}
            onStartTest={handleStartTest}
            onBack={() => setStep('upload')}
          />
        )}

        {step === 'exam' && testConfig && (
          <ExamInterface
            testConfig={testConfig}
            onFinishExam={handleFinishExam}
          />
        )}

        {step === 'results' && examResult && (
          <ExamResults
            resultData={examResult}
            onRetake={() => setStep('exam')}
            onNewTest={handleReset}
          />
        )}
      </main>
    </div>
  );
}

