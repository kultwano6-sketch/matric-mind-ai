export default async function handler(req: any, res: any) {
      try {
          const { prompt } = JSON.parse(req.body);

              // TEMP FAKE AI RESPONSE (so app works immediately)
                  const reply = `AI Response: ${prompt}`;

                      res.status(200).json({ reply });
                        } catch (err) {
                            res.status(500).json({ error: "AI failed" });
                              }
                              }
}