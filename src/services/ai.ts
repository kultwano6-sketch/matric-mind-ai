export const askAI = async (prompt: string) => {
    try {
        const res = await fetch("http://localhost:3001/api/ai", {
              method: "POST",
                    headers: {
                            "Content-Type": "application/json",
                                  },
                                        body: JSON.stringify({ prompt }),
                                            });

                                                // Check if response is OK
                                                    if (!res.ok) {
                                                          throw new Error("Failed to get AI response");
                                                              }

                                                                  const data = await res.json();

                                                                      // Safety check
                                                                          if (!data.reply) {
                                                                                throw new Error("Invalid AI response format");
                                                                                    }

                                                                                        return data.reply;
                                                                                          } catch (error) {
                                                                                              console.error("AI Error:", error);
                                                                                                  return "Something went wrong with AI.";
                                                                                                    }
                                                                                                    };
;
