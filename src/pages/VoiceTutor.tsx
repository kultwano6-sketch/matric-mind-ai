import { askAI } from "../services/ai";

export default function VoiceTutor() {
  const start = () => {
      const recognition = new (window as any).webkitSpeechRecognition();

          recognition.onresult = async (event: any) => {
                const text = event.results[0][0].transcript;
                      const reply = await askAI(text);

                            speechSynthesis.speak(new SpeechSynthesisUtterance(reply));
                                };

                                    recognition.start();
                                      };

                                        return (
                                            <div>
                                                  <h1>Voice Tutor</h1>
                                                        <button onClick={start}>Start Talking</button>
                                                            </div>
                                                              );
                                                              }