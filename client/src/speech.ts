/**
 * HANDSPEAK — speech I/O (Web Speech API, free + in-browser).
 * TTS speaks recognized fingerspelling; STT hears the hearing side.
 * STT is Chrome-only — the text input is the universal fallback.
 */

let voiceEnabled = true;
export function setVoiceEnabled(on: boolean) { voiceEnabled = on; }
export function isVoiceEnabled() { return voiceEnabled; }

export function speak(text: string) {
  if (!voiceEnabled || !('speechSynthesis' in window) || !text) return;
  const u = new SpeechSynthesisUtterance(text.toLowerCase());
  const voices = speechSynthesis.getVoices();
  const en = voices.find(v => v.lang.startsWith('en') && v.localService) ?? voices.find(v => v.lang.startsWith('en'));
  if (en) u.voice = en;
  u.rate = 0.95;
  u.pitch = 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

export interface ListenHandle { stop: () => void }

export function startListening(
  onText: (text: string, final: boolean) => void,
  onEnd: () => void,
): ListenHandle | null {
  const W = window as unknown as Record<string, unknown>;
  const SR = (W.SpeechRecognition ?? W.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | undefined;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = 'en-US';
  rec.continuous = false;
  rec.interimResults = true;
  rec.onresult = (e: SpeechRecognitionEventLike) => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (final) onText(final.trim(), true);
    else if (interim) onText(interim.trim(), false);
  };
  rec.onend = () => onEnd();
  rec.onerror = () => onEnd();
  try { rec.start(); } catch { return null; }
  return { stop: () => { try { rec.stop(); } catch { /* already stopped */ } } };
}

interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void; stop(): void;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
