export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body || {};

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing or invalid prompt" });
    }

    // TEMP FAKE AI RESPONSE (so app works immediately)
    const reply = `AI Response: ${prompt}`;
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("AI handler error:", err);
    return res.status(500).json({ error: "AI failed" });
  }
}
