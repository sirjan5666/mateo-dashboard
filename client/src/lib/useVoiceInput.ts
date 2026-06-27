import { useRef, useState } from 'react';
import { createRecognition, speechRecognitionSupported, stopSpeaking } from './speech';
import type { SpeechRecognitionLike } from './speech';
import { useLang } from '../i18n/context';

// Tap-to-talk for the Tara entry points (launcher + dashboard ask-bar). Reuses the
// browser-native Web Speech recognition the full chat page already uses; degrades
// gracefully (supported=false) when the browser can't do it.
export function useVoiceInput(onTranscript: (text: string) => void): { supported: boolean; listening: boolean; toggle: () => void } {
  const { lang } = useLang();
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = createRecognition(lang);
    if (!rec) return;
    recRef.current = rec;
    stopSpeaking();
    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript ?? '';
      if (transcript) onTranscript(transcript);
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    rec.onerror = () => {
      setListening(false);
      recRef.current = null;
    };
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  return { supported: speechRecognitionSupported, listening, toggle };
}
