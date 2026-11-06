import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, ChevronLeft, ChevronRight, Bookmark, CheckCircle, Flag } from 'lucide-react';

export default function ExamInterface({ testConfig, onFinishExam }) {
  const { questions, durationMinutes, marksPerQuestion, negativeMarking } = testConfig;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [qId]: selectedOptIndex }
  const [markedForReview, setMarkedForReview] = useState(new Set());
  const [visited, setVisited] = useState(new Set([questions[0]?.id]));
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);

  // Countdown timer logic
  useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const currentQ = questions[currentIndex];

  const handleSelectOption = (optIdx) => {
    setAnswers(prev => ({ ...prev, [currentQ.id]: optIdx }));
  };

  const clearSelection = () => {
    setAnswers(prev => {
      const copy = { ...prev };
      delete copy[currentQ.id];
      return copy;
    });
  };

  const toggleReview = () => {
    setMarkedForReview(prev => {
      const next = new Set(prev);
      if (next.has(currentQ.id)) {
        next.delete(currentQ.id);
      } else {
        next.add(currentQ.id);
      }
      return next;
    });
  };

  const goToQuestion = (idx) => {
    if (idx >= 0 && idx < questions.length) {
      setCurrentIndex(idx);
      setVisited(prev => new Set(prev).add(questions[idx].id));
    }
  };

  const handleSubmit = () => {
    // Calculate results
    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unattemptedCount = 0;

    questions.forEach(q => {
      const userAns = answers[q.id];
      if (userAns === undefined) {
        unattemptedCount++;
      } else if (userAns === q.correctAnswer) {
        correctCount++;
        score += marksPerQuestion;
      } else {
        wrongCount++;
        score -= negativeMarking;
      }
    });

    onFinishExam({
      score: Math.max(0, score),
      correctCount,
      wrongCount,
      unattemptedCount,
      totalQuestions: questions.length,
      maxScore: questions.length * marksPerQuestion,
      answers,
      questions,
      timeTaken: (durationMinutes * 60) - timeLeft
    });
  };

  // Format timer MM:SS
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const isUrgent = timeLeft < 120; // under 2 mins

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Exam Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
            CBT
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-sm">Online Mock Examination</h2>
            <p className="text-xs text-slate-500">Auto-submit active upon timer expiration</p>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className={`flex items-center space-x-2 font-mono text-lg font-bold px-4 py-1.5 rounded-xl border ${
            isUrgent ? "bg-rose-50 text-rose-600 border-rose-300 animate-pulse" : "bg-slate-50 text-slate-700 border-slate-200"
          }`}>
            <Clock className="w-5 h-5" />
            <span>{timeFormatted}</span>
          </div>

          <button
            onClick={handleSubmit}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all"
          >
            Submit Test
          </button>
        </div>
      </div>

      {/* Main Examination Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left: Question Box */}
        <div className="lg:col-span-3 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Question Title Bar */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="font-bold text-slate-700 text-sm">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <div className="flex items-center space-x-3 text-xs">
              <span className="text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                +{marksPerQuestion} Marks
              </span>
              <span className="text-rose-600 font-semibold bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                -{negativeMarking} Penalty
              </span>
            </div>
          </div>

          {/* Question Text */}
          <div className="p-6 md:p-8 flex-1 overflow-y-auto">
            <p className="text-lg font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">
              {currentQ.text}
            </p>

            {/* Options list */}
            <div className="mt-8 space-y-3">
              {currentQ.options.map((opt, optIdx) => {
                const isSelected = answers[currentQ.id] === optIdx;
                return (
                  <label
                    key={optIdx}
                    onClick={() => handleSelectOption(optIdx)}
                    className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/60 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question_${currentQ.id}`}
                      checked={isSelected}
                      onChange={() => handleSelectOption(optIdx)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <span className="ml-3.5 text-base font-normal text-slate-800">
                      {opt}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Bottom Question Actions */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleReview}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 border transition-colors ${
                  markedForReview.has(currentQ.id)
                    ? "bg-purple-100 text-purple-700 border-purple-300"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                <Flag className="w-3.5 h-3.5" />
                <span>{markedForReview.has(currentQ.id) ? "Marked for Review" : "Mark for Review"}</span>
              </button>

              <button
                onClick={clearSelection}
                disabled={answers[currentQ.id] === undefined}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-slate-500 hover:text-slate-800 border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Clear Response
              </button>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => goToQuestion(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <button
                onClick={() => goToQuestion(currentIndex + 1)}
                disabled={currentIndex === questions.length - 1}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                <span>Save & Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Question Palette & Legend */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 text-sm mb-4">Question Palette</h3>
            
            {/* Grid of question numbers */}
            <div className="grid grid-cols-5 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = answers[q.id] !== undefined;
                const isMarked = markedForReview.has(q.id);
                const isSeen = visited.has(q.id);

                let bgClass = "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200";
                if (isMarked && isAnswered) {
                  bgClass = "bg-purple-600 text-white border-purple-700 font-bold";
                } else if (isMarked) {
                  bgClass = "bg-purple-100 text-purple-700 border-purple-300 font-bold";
                } else if (isAnswered) {
                  bgClass = "bg-emerald-600 text-white border-emerald-700 font-bold";
                } else if (isSeen) {
                  bgClass = "bg-rose-100 text-rose-700 border-rose-300 font-bold";
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => goToQuestion(idx)}
                    className={`h-10 rounded-xl text-xs font-semibold flex items-center justify-center border transition-all ${bgClass} ${
                      isCurrent ? "ring-2 ring-blue-600 ring-offset-2 scale-105" : ""
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Status Legend */}
            <div className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex items-center space-x-2">
                <span className="w-4 h-4 rounded-md bg-emerald-600 inline-block"></span>
                <span className="text-slate-600">Answered</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-4 h-4 rounded-md bg-rose-100 border border-rose-300 inline-block"></span>
                <span className="text-slate-600">Not Answered</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-4 h-4 rounded-md bg-purple-100 border border-purple-300 inline-block"></span>
                <span className="text-slate-600">Marked for Review</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-4 h-4 rounded-md bg-slate-100 border border-slate-200 inline-block"></span>
                <span className="text-slate-600">Not Visited</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

