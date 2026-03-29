const API_BASE = import.meta.env.VITE_API_URL || '';

export const askAI = async (prompt: string) => {
  try {
    const res = await fetch(`${API_BASE}/api/ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      throw new Error('Failed to get AI response');
    }

    const data = await res.json();

    if (!data.reply) {
      throw new Error('Invalid AI response format');
    }

    return data.reply;
  } catch (error) {
    console.error('AI Error:', error);
    return 'Something went wrong with AI.';
  }
};
