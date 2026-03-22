import { askAI } from "../services/ai";

export default function SnapSolve() {
  const handleFile = async (file: File | null) => {
      if (!file) {
            alert("No file selected");
                  return;
                      }

                          try {
                                const result = await askAI("Solve this question from image");
                                      alert(result);
                                          } catch (error) {
                                                console.error(error);
                                                      alert("Failed to process image");
                                                          }
                                                            };

                                                              return (
                                                                  <div style={{ padding: 20 }}>
                                                                        <h1>📸 Snap & Solve</h1>

                                                                              <input
                                                                                      type="file"
                                                                                              onChange={(e) => handleFile(e.target.files?.[0] || null)}
                                                                                                    />
                                                                                                        </div>
                                                                                                          );
                                                                                                          }