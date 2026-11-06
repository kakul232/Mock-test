import React, { useState, useEffect } from 'react';
import { Trophy, CheckCircle2, XCircle, HelpCircle, RotateCcw, ArrowRight, Sparkles, Loader2, Info } from 'lucide-react';
import confetti from 'canvas-confetti';
import { solveAnswersWithAI } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function ExamResults({ resultData, onRetake, onNewTest }) {
  const { t, lang } = useLanguage();
  const { 
    score: initialScore, 
    maxScore, 
    correctCount: initialCorrect, 
    wrongCount: initialWrong, 
    unattemptedCount, 
    totalQuestions, 
    answers, 
    questions: initialQuestions, 
    timeTaken,
    marksPerQuestion = 4,
    negativeMarking = 1
  } = resultData;

  const [questions, setQuestions] = useState(initialQuestions);
  const [score, setScore] = useState(initialScore);
  const [correctCount, setCorrectCount] = useState(initialCorrect);
  const [wrongCount, setWrongCount] = useState(initialWrong);
  const [isAiChecking, setIsAiChecking] = useState(false);
  const [aiChecked, setAiChecked] = useState(false);

  // Automatically evaluate ONLY attempted/submitted questions with AI upon submitting test
  useEffect(() => {
    let isMounted = true;
    const checkWithAI = async () => {
      // Filter questions to only those the student actually answered/submitted
      const attemptedQuestions = questions.filter(q => answers[q.id] !== undefined);
      
      if (attemptedQuestions.length === 0) {
        setAiChecked(true);
        return;
      }

      setIsAiChecking(true);
      try {
        // Send ONLY attempted questions to AI to save quota & drastically speed up checking
        const solvedAttempted = await solveAnswersWithAI(attemptedQuestions);
        if (!isMounted || !solvedAttempted || solvedAttempted.length === 0) return;

        // Map solved answers back into the questions list by id
        const solvedMap = {};
        solvedAttempted.forEach(q => {
          solvedMap[q.id] = q;
        });

        const updatedQuestions = questions.map(q => {
          if (solvedMap[q.id]) {
            return {
              ...q,
              correctAnswer: solvedMap[q.id].correctAnswer,
              explanation: solvedMap[q.id].explanation
            };
          }
          return q;
        });

        setQuestions(updatedQuestions);
        setAiChecked(true);

        // Recalculate score based only on the AI-checked submitted questions
        let newScore = 0;
        let newCorrect = 0;
        let newWrong = 0;

        attemptedQuestions.forEach(q => {
          const userAns = answers[q.id];
          const solvedQ = solvedMap[q.id];
          if (solvedQ && userAns !== undefined && solvedQ.correctAnswer !== null) {
            if (userAns === solvedQ.correctAnswer) {
              newCorrect++;
              newScore += marksPerQuestion;
            } else {
              newWrong++;
              newScore -= negativeMarking;
            }
          }
        });

        setScore(Math.max(0, newScore));
        setCorrectCount(newCorrect);
        setWrongCount(newWrong);
      } catch (err) {
        console.error("AI post-submission answer check failed:", err);
      } finally {
        if (isMounted) setIsAiChecking(false);
      }
    };

    checkWithAI();

    return () => {
      isMounted = false;
    };
  }, []);

  const percentage = Math.round((score / (maxScore || 1)) * 100);

  useEffect(() => {
    if (percentage >= 50 && !isAiChecking) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [percentage, isAiChecking]);

  const mins = Math.floor(timeTaken / 60);
  const secs = timeTaken % 60;

  return (
    <div className="max-w-4xl mx-auto my-8 px-4">
      {/* Score Summary Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-8 text-center relative">
        <div className="inline-flex p-4 rounded-2xl bg-amber-50 text-amber-500 mb-4 shadow-sm">
          <Trophy className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-800">
          {lang === 'as' ? 'মক পৰীক্ষা সম্পন্ন হৈছে!' : 'Mock Examination Completed!'}
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          {lang === 'as' 
            ? 'পৰীক্ষাৰ ফলাফল আৰু সম্পূৰ্ণ মূল্যায়ন তলত দিয়া হৈছে।' 
            : 'Here is a comprehensive breakdown of your performance'}
        </p>

        {/* AI Evaluation Status Banner */}
        {isAiChecking ? (
          <div className="my-6 inline-flex items-center space-x-2 bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2 rounded-xl text-sm font-semibold animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            <span>
              {lang === 'as' 
                ? 'AI ইঞ্জিনে শুদ্ধ উত্তৰসমূহ পৰীক্ষা কৰি নম্বৰ গণনা কৰি আছে...' 
                : 'AI is evaluating your answers and generating explanations...'}
            </span>
          </div>
        ) : aiChecked && (
          <div className="my-6 inline-flex items-center space-x-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-semibold">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>
              {lang === 'as' 
                ? 'AI দ্বাৰা উত্তৰসমূহ পৰীক্ষা আৰু ব্যাখ্যা সম্পন্ন হৈছে' 
                : 'Answers verified and scored with AI intelligence'}
            </span>
          </div>
        )}

        {/* Big Score Display */}
        <div className="my-6">
          <div className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            {score} <span className="text-2xl text-slate-400 font-normal">/ {maxScore}</span>
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-600">
            {t('accuracy')}: <span className="text-blue-600 font-bold">{percentage}%</span> • {t('timeSpent')}: {mins}m {secs}s
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto">
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
            <div className="flex items-center justify-center space-x-1 text-emerald-600 mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">{lang === 'as' ? 'শুদ্ধ' : 'Correct'}</span>
            </div>
            <div className="text-2xl font-black text-emerald-700">{correctCount}</div>
          </div>

          <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
            <div className="flex items-center justify-center space-x-1 text-rose-600 mb-1">
              <XCircle className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">{lang === 'as' ? 'ভুল' : 'Wrong'}</span>
            </div>
            <div className="text-2xl font-black text-rose-700">{wrongCount}</div>
          </div>

          <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-center space-x-1 text-slate-600 mb-1">
              <HelpCircle className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">{lang === 'as' ? 'উত্তৰহীন' : 'Unattempted'}</span>
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
            <span>{lang === 'as' ? 'পুনৰ পৰীক্ষা দিয়ক' : 'Retake Test'}</span>
          </button>

          <button
            onClick={onNewTest}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center space-x-2 shadow-lg shadow-blue-500/25 transition-all active:scale-95"
          >
            <span>{t('uploadNew')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Item-by-item Solution & Answer Key */}
      <div className="mt-10 space-y-4">
        <h3 className="text-xl font-bold text-slate-800">
          {lang === 'as' ? 'প্ৰশ্নোত্তৰ আৰু AI বিশদ ব্যাখ্যা' : 'Detailed Solution & AI Answer Key'}
        </h3>

        {questions.map((q, idx) => {
          const userAns = answers[q.id];
          const hasAnswerKey = q.correctAnswer !== null && q.correctAnswer !== undefined;
          const isCorrect = hasAnswerKey && userAns === q.correctAnswer;
          const isUnattempted = userAns === undefined;

          return (
            <div
              key={q.id}
              className={`bg-white rounded-2xl border p-6 shadow-sm transition-all ${
                !hasAnswerKey
                  ? "border-slate-200"
                  : isCorrect 
                  ? "border-emerald-200" 
                  : isUnattempted 
                  ? "border-slate-200" 
                  : "border-rose-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start space-x-3 flex-1">
                  <span className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                    !hasAnswerKey
                      ? "bg-slate-100 text-slate-600"
                      : isCorrect 
                      ? "bg-emerald-100 text-emerald-800" 
                      : isUnattempted 
                      ? "bg-slate-100 text-slate-600" 
                      : "bg-rose-100 text-rose-800"
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 text-base">{q.text}</p>

                    {/* Options list showing user choice vs AI correct answer */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                      {q.options.map((opt, optIdx) => {
                        const isUserChoice = userAns === optIdx;
                        const isRightChoice = q.correctAnswer === optIdx;

                        let optClass = "bg-slate-50 border-slate-200 text-slate-700";
                        if (isRightChoice) {
                          optClass = "bg-emerald-50 border-emerald-400 text-emerald-950 font-semibold";
                        } else if (isUserChoice && hasAnswerKey && !isCorrect) {
                          optClass = "bg-rose-50 border-rose-300 text-rose-900 font-semibold line-through";
                        } else if (isUserChoice) {
                          optClass = "bg-blue-50 border-blue-300 text-blue-900 font-semibold";
                        }

                        return (
                          <div key={optIdx} className={`p-3 rounded-xl border text-sm flex items-center justify-between ${optClass}`}>
                            <span>{opt}</span>
                            {isRightChoice && (
                              <span className="text-xs font-bold text-emerald-700 ml-2">✓ {lang === 'as' ? 'শুদ্ধ উত্তৰ' : 'Correct'}</span>
                            )}
                            {isUserChoice && !isRightChoice && (
                              <span className="text-xs font-bold text-slate-600 ml-2">{lang === 'as' ? 'আপোনাৰ উত্তৰ' : 'Your Answer'}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* AI Generated Explanation */}
                    {q.explanation && (
                      <div className="mt-4 p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-950">
                        <span className="font-bold text-indigo-900 flex items-center space-x-1.5 mb-1">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{lang === 'as' ? 'AI ব্যাখ্যা:' : 'AI Explanation:'}</span>
                        </span>
                        <p className="leading-relaxed">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  {!hasAnswerKey ? (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                      {lang === 'as' ? 'মূল্যায়ন চলি আছে' : 'Evaluating...'}
                    </span>
                  ) : isCorrect ? (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                      {lang === 'as' ? 'শুদ্ধ' : 'Correct'}
                    </span>
                  ) : isUnattempted ? (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                      {lang === 'as' ? 'উত্তৰহীন' : 'Skipped'}
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800">
                      {lang === 'as' ? 'ভুল' : 'Incorrect'}
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
