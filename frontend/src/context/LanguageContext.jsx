import React, { createContext, useContext, useState, useEffect } from 'react';

export const translations = {
  as: {
    appName: "ExamPulse AI",
    tagline: "স্মাৰ্ট PDF মক টেষ্ট প্লেটফৰ্ম",
    freePlan: "১০০% বিনামূলীয়া ব্যৱহাৰ",
    uploadTitle: "PDF প্ৰশ্নকাকত আপলোড কৰক",
    uploadDesc: "আপোনাৰ প্ৰশ্নকাকত আপলোড কৰক। আমাৰ AI ইঞ্জিনে প্ৰশ্ন, বিকল্পসমূহ আৰু নম্বৰ নিজে নিজে উলিয়াই সাজু কৰিব।",
    dragDropText: "PDF ফাইল ইয়াত ক্লিক কৰক বা টানি আনক",
    dragDropSub: "বহুতো .pdf ফাইল সমৰ্থন কৰে (TET, APSC, UPSC, বিশ্ববিদ্যালয় পৰীক্ষা)",
    selectedFiles: "বাচনি কৰা ফাইলসমূহ",
    startExtraction: "প্ৰশ্ন নিষ্কাশন কৰক আৰু মক টেষ্ট প্ৰস্তুত কৰক",
    processingPdf: "PDF প্ৰক্ৰিয়াকৰণ চলি আছে",
    remaining: "বাকী থকা সময়",
    testSetupTitle: "পৰীক্ষাৰ ছেটিংছ আৰু নম্বৰ ব্যৱস্থা",
    testSetupDesc: "নিষ্কাশিত প্ৰশ্নসমূহ পৰীক্ষা কৰক, সময়সীমা নিৰ্ধাৰণ কৰক আৰু নম্বৰ পদ্ধতি ঠিক কৰক।",
    uploadMore: "অধিক আপলোড কৰক",
    startMockTest: "মক টেষ্ট আৰম্ভ কৰক",
    testDuration: "পৰীক্ষাৰ সময়",
    minutes: "মিনিট",
    correctAnswerMarks: "শুদ্ধ উত্তৰৰ নম্বৰ",
    marks: "নম্বৰ",
    negativeMarking: "ঋণাত্মক নম্বৰ",
    penalty: "নম্বৰ কৰ্তন",
    extractedQuestions: "নিষ্কাশিত প্ৰশ্নসমূহ",
    autoSolveAI: "AI ৰ দ্বাৰা শুদ্ধ উত্তৰ সন্ধান কৰক",
    solvingAI: "AI এ উত্তৰ সমাধান কৰিছে...",
    addQuestion: "প্ৰশ্ন যোগ কৰক",
    saveAndNext: "সংৰক্ষণ আৰু পৰৱৰ্তী",
    submitTest: "পৰীক্ষা জমা দিয়ক",
    questionPalette: "প্ৰশ্ন তালিকা",
    resultsTitle: "পৰীক্ষাৰ ফলাফল বিশ্লেষণ",
    scoreCard: "নম্বৰ তালিকা",
    totalScore: "মুঠ নম্বৰ",
    accuracy: "সঠিকতা",
    timeSpent: "ব্যয় হোৱা সময়",
    uploadNew: "নতুন প্ৰশ্নকাকত আপলোড কৰক"
  },
  en: {
    appName: "ExamPulse AI",
    tagline: "Smart PDF Mock Test Engine",
    freePlan: "100% Free Plan Ready",
    uploadTitle: "Upload PDF Question Papers",
    uploadDesc: "Upload question paper booklets. The AI extraction pipeline will extract questions, choices, answers, and marks automatically.",
    dragDropText: "Click or Drag & Drop PDFs here",
    dragDropSub: "Supports multiple .pdf files (Gate, CTET, JEE, UPSC, University exams)",
    selectedFiles: "Selected Files",
    startExtraction: "Extract Questions & Prepare Mock Test",
    processingPdf: "Processing PDF",
    remaining: "remaining",
    testSetupTitle: "Test Setup & Marking Scheme",
    testSetupDesc: "Review extracted questions, configure the timer countdown, and set the scoring rules.",
    uploadMore: "Upload More",
    startMockTest: "Start Mock Test",
    testDuration: "Test Duration",
    minutes: "Minutes",
    correctAnswerMarks: "Correct Answer",
    marks: "Marks",
    negativeMarking: "Negative Marking",
    penalty: "Marks penalty",
    extractedQuestions: "Extracted Questions",
    autoSolveAI: "Auto-Solve Answers with AI",
    solvingAI: "AI Solving Answers...",
    addQuestion: "Add Question",
    saveAndNext: "Save & Next",
    submitTest: "Submit Test",
    questionPalette: "Question Palette",
    resultsTitle: "Exam Performance Analysis",
    scoreCard: "Score Summary",
    totalScore: "Total Score",
    accuracy: "Accuracy",
    timeSpent: "Time Spent",
    uploadNew: "Upload New Question Paper"
  }
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  // Default language is Assamese ('as')
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('app_language') || 'as';
  });

  useEffect(() => {
    localStorage.setItem('app_language', lang);
  }, [lang]);

  const t = (key) => {
    return translations[lang]?.[key] || translations['en']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

