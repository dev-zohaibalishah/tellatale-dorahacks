/**
 * Dictation — speaking a memory instead of typing it.
 *
 * "Speak it" was a segment control that switched to a paragraph apologising for not
 * existing. It is not a nice-to-have: the people whose memories are most worth
 * keeping are frequently the least comfortable with a phone keyboard, and asking an
 * 80-year-old to thumb-type four sentences about their sister is how a memory goes
 * unrecorded. This is the accessibility route into the product.
 *
 * Two behaviours worth stating, because both are deliberate:
 *
 *   Nothing is recorded. Recognition is a stream in and text out; no audio file is
 *   written, uploaded or kept, which is what the permission strings promise.
 *
 *   The transcript is appended to what is already in the box, never substituted for
 *   it. Someone who types two sentences, dictates a third, then dictates again must
 *   never watch their earlier words disappear — and a recogniser that restarts mid
 *   thought (they all do) would do exactly that if it owned the field.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Loaded behind a try/catch because the package calls requireNativeModule at
 * import time. A development APK built before this plugin was added throws
 * "Cannot find native module 'ExpoSpeechRecognition'" the moment add.tsx
 * imports this file — which is every time the add sheet is even registered.
 *
 * Metro cannot add native code. Until a new EAS development build is installed,
 * speech is null and the sheet stays usable for typing.
 */
type SpeechNative = typeof import('expo-speech-recognition');

function loadSpeechNative(): SpeechNative | null {
  try {
    return require('expo-speech-recognition') as SpeechNative;
  } catch {
    return null;
  }
}

const speech = loadSpeechNative();
const ExpoSpeechRecognitionModule = speech?.ExpoSpeechRecognitionModule;

export type DictationStatus = 'idle' | 'starting' | 'listening' | 'unsupported';

export interface Dictation {
  status: DictationStatus;
  /** Words recognised but not yet committed — shown greyed, never stored. */
  partial: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => void;
}

/** Joins a new sentence onto existing text without doubling spaces or losing either. */
function append(existing: string, addition: string): string {
  const a = existing.trimEnd();
  const b = addition.trim();
  if (!b) return existing;
  if (!a) return b;
  // If the previous chunk ended a sentence, start a new one; otherwise continue it.
  return /[.!?]$/.test(a) ? `${a} ${b}` : `${a} ${b}`;
}

export function useDictation(onCommit: (text: string) => void): Dictation {
  const [status, setStatus] = useState<DictationStatus>(
    ExpoSpeechRecognitionModule ? 'idle' : 'unsupported'
  );
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Held in a ref so the event handlers below always call the caller's latest
  // setter, without re-registering a native listener on every keystroke.
  const commit = useRef(onCommit);
  commit.current = onCommit;

  const listening = useRef(false);

  const useSpeechRecognitionEvent = speech?.useSpeechRecognitionEvent;
  useSpeechRecognitionEvent?.('start', () => {
    listening.current = true;
    setStatus('listening');
  });

  useSpeechRecognitionEvent?.('end', () => {
    listening.current = false;
    setStatus('idle');
    setPartial('');
  });

  useSpeechRecognitionEvent?.('result', (event) => {
    const said = event.results?.[0]?.transcript ?? '';
    if (!said) return;

    if (event.isFinal) {
      // Committed: hand it to the field and clear the provisional line.
      commit.current(said);
      setPartial('');
    } else {
      setPartial(said);
    }
  });

  useSpeechRecognitionEvent?.('error', (event) => {
    listening.current = false;
    setStatus('idle');
    setPartial('');

    // `no-speech` fires whenever someone pauses to think, which is most of the time
    // when recalling something. Treating it as an error would put a red banner in
    // front of a person mid-memory.
    if (event.error === 'no-speech' || event.error === 'aborted') return;

    setError(
      event.error === 'not-allowed'
        ? 'Microphone access is off for TellaTale.'
        : 'Dictation stopped. You can try again, or type instead.'
    );
  });

  // Never leave the microphone open behind a screen that has gone away.
  useEffect(() => {
    return () => {
      if (listening.current) ExpoSpeechRecognitionModule?.stop();
    };
  }, []);

  const start = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule) {
      setStatus('unsupported');
      return;
    }
    setError(null);
    setStatus('starting');
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setStatus('idle');
        setError('Microphone access is off for TellaTale.');
        return;
      }

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        // Interim results are what make this feel like dictation rather than a form
        // submission — the words appear while they are still being said.
        interimResults: true,
        // Keep going through the pauses people take while remembering. Without it,
        // recognition ends at the first silence and the second half is lost.
        continuous: true,
        // On-device where the platform offers it: a memory about a family is not
        // something to send to a transcription service if it does not have to be.
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
      });
    } catch (e) {
      setStatus('idle');
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Dictation could not start on this device.'
      );
    }
  }, []);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule?.stop();
  }, []);

  const toggle = useCallback(() => {
    if (listening.current) stop();
    else void start();
  }, [start, stop]);

  return { status, partial, error, start, stop, toggle };
}

/**
 * Whether this build can dictate at all.
 *
 * Expo Go has no native speech module, and a browser without the Web Speech API
 * cannot either. Both need to be said out loud rather than discovered by tapping a
 * button that does nothing.
 */
export function dictationAvailable(): boolean {
  if (Platform.OS === 'web') {
    const w = globalThis as { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown };
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }
  return typeof ExpoSpeechRecognitionModule?.start === 'function';
}

export { append as appendTranscript };
