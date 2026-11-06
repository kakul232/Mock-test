import React, { useState } from 'react';
import { Trophy, CheckCircle2, XCircle, HelpCircle, RotateCcw, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
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
  const [evaluatingQuestionId, setEvaluatingQuestionId] = useState(null);

  // Individual question evaluation on demand (NO auto evaluation)
  const handleEvaluateIndividual = async (qId) => {
    const targetQ = questions.find(q => q.id === qId);
    if (!targetQ) return;

    setEvaluatingQuestionId(qId);
    try {
      const solved = await solveAnswersWithAI([targetQ]);
      if (solved && solved.length > 0) {
        const solvedItem = solved[0];

        setQuestions(prev => {
          const updated = prev.map(q => {
            if (q.id === qId) {
              return {
                ...q,
                correctAnswer: solvedItem.correctAnswer,
                explanation: solvedItem.explanation
              };
            }
            return q;
          });

          // Recalculate score for evaluated questions
          let newScore = 0;
          let newCorrect = 0;
          let newWrong = 0;

          updated.forEach(q => {
            const userAns = answers[q.id];
            if (userAns !== undefined && q.correctAnswer !== null && q.correctAnswer !== undefined) {
              if (userAns === q.correctAnswer) {
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

          return updated;
        });
      }
    } catch (err) {
      console.error(`Individual AI evaluation failed for question ${qId}:`, err);
    } finally {
      setEvaluatingQuestionId(null);
    }
  };

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
            ? 'প্ৰশ্নসমূহৰ উত্তৰ পৰীক্ষা কৰিবলৈ প্ৰতিটো প্ৰশ্নৰ সৈতে থকা "AI Evaluation" বুটামত ক্লিক কৰক।' 
            : 'Click the "AI Evaluation" button on any question to check the answer and explanation with AI.'}
        </p>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto my-6">
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

        <div className="text-xs text-slate-500 font-medium">
          {t('timeSpent')}: {mins}m {secs}s • {totalQuestions} {lang === 'as' ? 'মুঠ প্ৰশ্ন' : 'Total Questions'}
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
          {lang === 'as' ? 'প্ৰশ্নসমূহ আৰু ব্যক্তিগত AI মূল্যায়ন' : 'Questions & Individual AI Evaluation'}
        </h3>

        {questions.map((q, idx) => {
          const userAns = answers[q.id];
          const hasAnswerKey = q.correctAnswer !== null && q.correctAnswer !== undefined;
          const isCorrect = hasAnswerKey && userAns === q.correctAnswer;
          const isUnattempted = userAns === undefined;
          const isEvaluating = evaluatingQuestionId === q.id;

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

                    {/* Options list */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                      {q.options.map((opt, optIdx) => {
                        const isUserChoice = userAns === optIdx;
                        const isRightChoice = hasAnswerKey && q.correctAnswer === optIdx;

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
                              <span className="text-xs font-bold text-blue-700 ml-2">{lang === 'as' ? 'আপোনাৰ উত্তৰ' : 'Your Answer'}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* AI Generated Explanation if evaluated */}
                    {q.explanation && (
                      <div className="mt-4 p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-950">
                        <span className="font-bold text-indigo-900 flex items-center space-x-1.5 mb-1">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{lang === 'as' ? 'AI বিশদ ব্যাখ্যা:' : 'AI Explanation:'}</span>
                        </span>
                        <p className="leading-relaxed">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                  {/* Status Tag */}
                  {hasAnswerKey ? (
                    isCorrect ? (
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
                    )
                  ) : (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                      {isUnattempted 
                        ? (lang === 'as' ? 'উত্তৰহীন' : 'Not Answered') 
                        : (lang === 'as' ? 'জমা দিয়া হৈছে' : 'Submitted')}
                    </span>
                  )}

                  {/* Individual AI Evaluation Button */}
                  {!hasAnswerKey && (
                    <button
                      onClick={() => handleEvaluateIndividual(q.id)}
                      disabled={isEvaluating}
                      className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 hover:text-purple-800 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                      title="Evaluate this question with AI"
                    >
                      {isEvaluating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                          <span>{lang === 'as' ? 'পৰীক্ষা কৰি আছে...' : 'Evaluating...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          <span>{lang === 'as' ? 'AI দ্বাৰা পৰীক্ষা কৰক' : 'Check with AI'}</span>
                        </>
                      )}
                    </button>
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
