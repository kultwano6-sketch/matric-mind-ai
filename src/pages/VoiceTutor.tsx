import { askAI } from "../services/ai";

type SpeechRecognitionConstructor = new () => SpeechRecognition;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export default function VoiceTutor() {
  const start = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Recognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new Recognition();

    recognition.onresult = async (event: SpeechRecognitionEvent) => {
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