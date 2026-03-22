import { askAI } from "../services/ai";

export default function VoiceTutor() {
  const start = () => {
      const SpeechRecognition =
            (window as any).SpeechRecognition ||
                  (window as any).webkitSpeechRecognition;

                      // Safety check (VERY IMPORTANT)
                          if (!SpeechRecognition) {
                                alert("Voice recognition not supported on this device");
                                      return;
                                          }

                                              const recognition = new SpeechRecognition();

                                                  recognition.onresult = async (event: any) => {
                                                        try {
                                                                const text = event.results[0][0].transcript;

                                                                        // Send to AI
                                                                                const reply = await askAI(text);

                                                                                        // Speak response
                                                                                                const speech = new SpeechSynthesisUtterance(reply);
                                                                                                        speechSynthesis.speak(speech);

                                                                                                              } catch (error) {
                                                                                                                      console.error(error);
                                                                                                                              alert("Voice processing failed");
                                                                                                                                    }
                                                                                                                                        };

                                                                                                                                            recognition.onerror = () => {
                                                                                                                                                  alert("Voice recognition error");
                                                                                                                                                      };

                                                                                                                                                          recognition.start();
                                                                                                                                                            };

                                                                                                                                                              return (
                                                                                                                                                                  <div style={{ padding: 20 }}>
                                                                                                                                                                        <h1>🎙️ Voice Tutor</h1>
                                                                                                                                                                              <button onClick={start}>Start Talking</button>
                                                                                                                                                                                  </div>
                                                                                                                                                                                    );
                                                                                                                                                                                    }