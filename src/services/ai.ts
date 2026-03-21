export async function askAI(prompt: string): Promise<string> {
  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result || "Unable to process your request";
  } catch (error) {
    console.error("AI service error:", error);
    throw error;
  }
}
