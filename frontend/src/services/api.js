/**
 * Service to communicate with HuggingFace Space backend or local Python FastAPI
 */

const DEFAULT_HF_ENDPOINT = "https://mock-test-w7wm.onrender.com/extract-questions";

export async function startExtractionJob(files, customEndpoint = null) {
  const base = (customEndpoint?.trim() || import.meta.env.VITE_EXTRACTION_API_URL || DEFAULT_HF_ENDPOINT)
    .replace("/extract-questions", "/start-extraction");

  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append("files", files[i]);
  }

  const response = await fetch(base, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Start extraction failed with HTTP ${response.status}`);
  }

  return await response.json(); // returns { success: true, jobId: "..." }
}

export async function checkExtractionProgress(jobId, customEndpoint = null) {
  const base = (customEndpoint?.trim() || import.meta.env.VITE_EXTRACTION_API_URL || DEFAULT_HF_ENDPOINT)
    .replace("/extract-questions", `/extraction-status/${jobId}`);

  const response = await fetch(base);
  if (!response.ok) {
    throw new Error(`Status check failed with HTTP ${response.status}`);
  }
  return await response.json(); // returns { status, progress, currentStage, questions }
}

export async function solveAnswersWithAI(questions, customEndpoint = null) {
  const baseEndpoint = (customEndpoint?.trim() || import.meta.env.VITE_EXTRACTION_API_URL || DEFAULT_HF_ENDPOINT)
    .replace("/extract-questions", "/solve-answers");

  try {
    const response = await fetch(baseEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions }),
    });

    if (!response.ok) {
      throw new Error(`Solving failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.solvedQuestions || questions;
  } catch (err) {
    console.warn("AI solve call failed, keeping current answers:", err);
    return questions;
  }
}

export async function extractQuestionsFromPDFs(files, customEndpoint = null, hfToken = null) {
  const endpoint = customEndpoint?.trim() || import.meta.env.VITE_EXTRACTION_API_URL || DEFAULT_HF_ENDPOINT;
  const token = hfToken?.trim() || import.meta.env.VITE_HF_TOKEN || "";
  
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append("files", files[i]);
  }
  
  if (token) {
    formData.append("hf_token", token);
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || `Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.warn("Backend request failed, generating mock sample questions for demonstration:", err);
    // If backend is not yet deployed or offline, provide immediate fallback demo data so user can experience full flow
    return {
      success: true,
      totalQuestions: 5,
      offlineFallback: true,
      errorMessage: err.message,
      questions: [
        {
          id: "q_1",
          questionNumber: 1,
          text: "Which of the following data structures operates on a Last In First Out (LIFO) principle?",
          options: ["A) Queue", "B) Stack", "C) Binary Tree", "D) Linked List"],
          correctAnswer: 1,
          explanation: "A Stack follows the Last-In, First-Out (LIFO) pattern where the most recently added item is popped first.",
          marks: 4
        },
        {
          id: "q_2",
          questionNumber: 2,
          text: "In React, what hook is used to perform side effects in functional components?",
          options: ["A) useState", "B) useContext", "C) useEffect", "D) useReducer"],
          correctAnswer: 2,
          explanation: "useEffect is specifically intended to handle lifecycle events and side effects in functional components.",
          marks: 4
        },
        {
          id: "q_3",
          questionNumber: 3,
          text: "What is the time complexity of searching an element in a balanced Binary Search Tree (BST)?",
          options: ["A) O(1)", "B) O(n)", "C) O(log n)", "D) O(n log n)"],
          correctAnswer: 2,
          explanation: "In a balanced BST, each comparison cuts the search space in half, resulting in O(log n) time complexity.",
          marks: 4
        },
        {
          id: "q_4",
          questionNumber: 4,
          text: "Which HTTP status code signifies that a resource was successfully created?",
          options: ["A) 200 OK", "B) 201 Created", "C) 204 No Content", "D) 301 Moved"],
          correctAnswer: 1,
          explanation: "HTTP 201 Created indicates that the request has succeeded and led to the creation of a resource.",
          marks: 4
        },
        {
          id: "q_5",
          questionNumber: 5,
          text: "In Python, which of the following keywords is used to define an anonymous / inline function?",
          options: ["A) def", "B) lambda", "C) func", "D) inline"],
          correctAnswer: 1,
          explanation: "The `lambda` keyword in Python creates small anonymous functions on the fly.",
          marks: 4
        }
      ]
    };
  }
}

