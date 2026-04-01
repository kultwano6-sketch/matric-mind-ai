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
