export default function VoiceTutor() {
    const start = () => {
        const SpeechRecognition =
              (window as any).SpeechRecognition ||
                    (window as any).webkitSpeechRecognition;

                        if (!SpeechRecognition) {
                              alert("Voice not supported");
                                    return;
                                        }

                                            const recognition = new SpeechRecognition();

                                                recognition.onresult = (event: any) => {
                                                      const text = event.results[0][0].transcript;
                                                            alert(text);
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
;