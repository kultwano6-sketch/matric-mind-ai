const API_BASE = import.meta.env.VITE_API_URL || '';

export const askAI = async (prompt: string): Promise<string> => {
  if (!prompt || prompt.trim().length === 0) {
    throw new Error('Prompt cannot be empty');
  }

  try {
    const res = await fetch(`${API_BASE}/api/ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: prompt.trim() }),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'Unknown error');
      console.error(`AI API error ${res.status}:`, errorBody);
      throw new Error(`Failed to get AI response: ${res.status}`);
    }

    const data = await res.json();

    if (!data.reply && !data.response) {
      console.error('Invalid AI response format:', data);
      throw new Error('Invalid AI response format');
    }

    return data.reply || data.response;
  } catch (error) {
    console.error('AI Error:', error);
    throw error; // Re-throw so callers can handle appropriately
  }
};

export const generateQuiz = async (subject: string, difficulty: string = 'medium', questionCount: number = 10): Promise<any> => {
  const res = await fetch(`${API_BASE}/api/generate-quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, difficulty, questionCount }),
  });
  if (!res.ok) throw new Error(`Quiz generation failed: ${res.status}`);
  return res.json();
};

export const submitQuiz = async (quizData: any): Promise<any> => {
  const res = await fetch(`${API_BASE}/api/grade-quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quizData),
  });
  if (!res.ok) throw new Error(`Quiz submission failed: ${res.status}`);
  return res.json();
};

export const getQuizHistory = async (): Promise<any[]> => {
  return [];
};
