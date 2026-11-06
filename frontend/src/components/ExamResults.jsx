import React, { useEffect } from 'react';
import { Trophy, CheckCircle2, XCircle, HelpCircle, RotateCcw, Share2, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ExamResults({ resultData, onRetake, onNewTest }) {
  const { score, maxScore, correctCount, wrongCount, unattemptedCount, totalQuestions, answers, questions, timeTaken } = resultData;
  const percentage = Math.round((score / (maxScore || 1)) * 100);

  useEffect(() => {
    if (percentage >= 50) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [percentage]);

  const mins = Math.floor(timeTaken / 60);
  const secs = timeTaken % 60;

  return (
    <div className="max-w-4xl mx-auto my-8 px-4">
      {/* Score Summary Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-8 text-center relative">
        <div className="inline-flex p-4 rounded-2xl bg-amber-50 text-amber-500 mb-4 shadow-sm">
          <Trophy className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-800">Mock Examination Completed!</h2>
        <p className="text-slate-500 text-sm mt-1">Here is a comprehensive breakdown of your performance</p>

        {/* Big Score Display */}
        <div className="my-8">
          <div className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            {score} <span className="text-2xl text-slate-400 font-normal">/ {maxScore}</span>
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-600">
            Accuracy Score: <span className="text-blue-600 font-bold">{percentage}%</span> • Time Spent: {mins}m {secs}s
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto">
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
            <div className="flex items-center justify-center space-x-1 text-emerald-600 mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Correct</span>
            </div>
            <div className="text-2xl font-black text-emerald-700">{correctCount}</div>
          </div>

          <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
            <div className="flex items-center justify-center space-x-1 text-rose-600 mb-1">
              <XCircle className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Wrong</span>
            </div>
            <div className="text-2xl font-black text-rose-700">{wrongCount}</div>
          </div>

          <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-center space-x-1 text-slate-600 mb-1">
              <HelpCircle className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Unattempted</span>
            </div>
            <div className="text-2xl font-black text-slate-700">{unattemptedCount}</div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-8 flex items-center justify-center space-x-4">
          <button
            onClick={onRetake}
            className="px-6 py-3 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm flex items-center space-x-2 transition-all active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retake Test</span>
          </button>

          <button
            onClick={onNewTest}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center space-x-2 shadow-lg shadow-blue-500/25 transition-all active:scale-95"
          >
            <span>Upload New Question Paper</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Item-by-item Solution & Answer Key */}
      <div className="mt-10 space-y-4">
        <h3 className="text-xl font-bold text-slate-800">Detailed Solution & Answer Key</h3>

        {questions.map((q, idx) => {
          const userAns = answers[q.id];
          const isCorrect = userAns === q.correctAnswer;
          const isUnattempted = userAns === undefined;

          return (
            <div
              key={q.id}
              className={`bg-white rounded-2xl border p-6 shadow-sm transition-all ${
                isCorrect 
                  ? "border-emerald-200" 
                  : isUnattempted 
                  ? "border-slate-200" 
                  : "border-rose-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <span className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                    isCorrect 
                      ? "bg-emerald-100 text-emerald-800" 
                      : isUnattempted 
                      ? "bg-slate-100 text-slate-600" 
                      : "bg-rose-100 text-rose-800"
                  }`}>
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800 text-base">{q.text}</p>

                    {/* Options list showing user vs correct answer */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                      {q.options.map((opt, optIdx) => {
                        const isUserChoice = userAns === optIdx;
                        const isRightChoice = q.correctAnswer === optIdx;

                        let optClass = "bg-slate-50 border-slate-200 text-slate-700";
                        if (isRightChoice) {
                          optClass = "bg-emerald-50 border-emerald-400 text-emerald-950 font-semibold";
                        } else if (isUserChoice && !isCorrect) {
                          optClass = "bg-rose-50 border-rose-300 text-rose-900 font-semibold line-through";
                        }

                        return (
                          <div key={optIdx} className={`p-3 rounded-xl border text-sm flex items-center justify-between ${optClass}`}>
                            <span>{opt}</span>
                            {isRightChoice && <span className="text-xs font-bold text-emerald-700 ml-2">✓ Correct</span>}
                            {isUserChoice && !isRightChoice && <span className="text-xs font-bold text-rose-600 ml-2">Your Answer</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="mt-4 p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900">
                        <span className="font-bold">Explanation: </span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  {isCorrect ? (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                      Correct
                    </span>
                  ) : isUnattempted ? (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                      Skipped
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800">
                      Incorrect
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

