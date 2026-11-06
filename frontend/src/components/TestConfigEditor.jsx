import React, { useState } from 'react';
import { Clock, Award, ShieldAlert, Play, Edit3, Trash2, Plus } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function TestConfigEditor({ questions, onStartTest, onBack }) {
  const { t, lang } = useLanguage();
  const [testQuestions, setTestQuestions] = useState(
    questions.map(q => ({
      ...q,
      correctAnswer: null // Clean initial state: no green answers pre-selected
    }))
  );
  const [durationMinutes, setDurationMinutes] = useState(Math.max(10, Math.ceil(questions.length * 1.5)));
  const [marksPerQuestion, setMarksPerQuestion] = useState(4);
  const [negativeMarking, setNegativeMarking] = useState(1);
  const [editingId, setEditingId] = useState(null);

  const handleQuestionTextChange = (id, newText) => {
    setTestQuestions(prev => prev.map(q => q.id === id ? { ...q, text: newText } : q));
  };

  const handleOptionChange = (qId, optIdx, newOpt) => {
    setTestQuestions(prev => prev.map(q => {
      if (q.id === qId) {
        const nextOpts = [...q.options];
        nextOpts[optIdx] = newOpt;
        return { ...q, options: nextOpts };
      }
      return q;
    }));
  };

  const deleteQuestion = (id) => {
    setTestQuestions(prev => prev.filter(q => q.id !== id));
  };

  const addQuestion = () => {
    const newNum = testQuestions.length + 1;
    const newQ = {
      id: `q_${Date.now()}`,
      questionNumber: newNum,
      text: lang === 'as' ? "নতুন প্ৰশ্নৰ মূল পাঠ্য ইয়াত লিখক..." : "New custom question prompt here...",
      options: ["(1) Option 1", "(2) Option 2", "(3) Option 3", "(4) Option 4"],
      correctAnswer: null,
      explanation: "",
      marks: marksPerQuestion
    };
    setTestQuestions([...testQuestions, newQ]);
    setEditingId(newQ.id);
  };

  const handleLaunch = () => {
    const preparedQuestions = testQuestions.map(q => ({
      ...q,
      marks: Number(marksPerQuestion)
    }));

    onStartTest({
      questions: preparedQuestions,
      durationMinutes: Number(durationMinutes),
      marksPerQuestion: Number(marksPerQuestion),
      negativeMarking: Number(negativeMarking)
    });
  };

  return (
    <div className="max-w-5xl mx-auto my-8 px-4">
      {/* Header & Settings Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{t('testSetupTitle')}</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              {t('testSetupDesc')}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              {t('uploadMore')}
            </button>
            <button
              onClick={handleLaunch}
              disabled={testQuestions.length === 0}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center space-x-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{t('startMockTest')}</span>
            </button>
          </div>
        </div>

        {/* Configuration inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center space-x-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-500 block uppercase">{t('testDuration')}</label>
              <div className="flex items-center space-x-2 mt-1">
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-20 font-bold text-lg bg-white border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                />
                <span className="text-sm font-medium text-slate-600">{t('minutes')}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center space-x-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
              <Award className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-500 block uppercase">{t('correctAnswerMarks')}</label>
              <div className="flex items-center space-x-2 mt-1">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={marksPerQuestion}
                  onChange={(e) => setMarksPerQuestion(e.target.value)}
                  className="w-20 font-bold text-lg bg-white border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800"
                />
                <span className="text-sm font-medium text-slate-600">{t('marks')}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center space-x-4">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-500 block uppercase">{t('negativeMarking')}</label>
              <div className="flex items-center space-x-2 mt-1">
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={negativeMarking}
                  onChange={(e) => setNegativeMarking(e.target.value)}
                  className="w-20 font-bold text-lg bg-white border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-rose-500 outline-none text-slate-800"
                />
                <span className="text-sm font-medium text-slate-600">{t('penalty')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Questions Preview List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">
            {t('extractedQuestions')} ({testQuestions.length})
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={addQuestion}
              className="flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('addQuestion')}</span>
            </button>
          </div>
        </div>

        {testQuestions.map((q, index) => {
          const isEditing = editingId === q.id;
          return (
            <div key={q.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 transition-all hover:border-slate-300">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start space-x-3 flex-1">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 font-bold text-slate-700 flex items-center justify-center text-sm">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    {isEditing ? (
                      <textarea
                        rows={3}
                        value={q.text}
                        onChange={(e) => handleQuestionTextChange(q.id, e.target.value)}
                        className="w-full text-slate-800 font-medium text-sm p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    ) : (
                      <p className="text-slate-800 font-semibold text-base leading-relaxed">{q.text}</p>
                    )}

                    {/* Options list: Neutral display without green pre-selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                      {q.options.map((opt, optIdx) => (
                        <div
                          key={optIdx}
                          className="p-3 rounded-xl border text-sm flex items-center justify-between bg-slate-50 border-slate-200 text-slate-700"
                        >
                          {isEditing ? (
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => handleOptionChange(q.id, optIdx, e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-xs"
                            />
                          ) : (
                            <span>{opt}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setEditingId(isEditing ? null : q.id)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title={isEditing ? "Save" : "Edit question"}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteQuestion(q.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
