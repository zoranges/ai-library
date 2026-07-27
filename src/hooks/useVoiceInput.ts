import { useState, useRef, useCallback, useEffect } from 'react';
import i18n from '@/i18n';

export type VoiceStatus = 'idle' | 'recording' | 'processing';

export interface VoiceResult {
  transcript: string;
  reply?: string;
  books?: Array<{
    id: string;
    title: string;
    author: string;
    coverUrl: string | null;
    description: string;
    rating: number;
    pageCount: number;
    difficulty: string;
    category: { name: string } | null;
  }>;
  warning?: string;
}

interface UseVoiceInputOptions {
  /** If true, only transcribe; if false, return transcript + agent reply (like wuye) */
  sttOnly?: boolean;
  /** Callback on success with the full result */
  onResult?: (result: VoiceResult) => void;
}

interface UseVoiceInputReturn {
  status: VoiceStatus;
  error: string | null;
  transcript: string | null;
  duration: number; // seconds elapsed while recording
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearTranscript: () => void;
  isSupported: boolean;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const { sttOnly = true, onResult } = options;

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartTime = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Keep options refs so callbacks don't trigger re-renders
  const optsRef = useRef(options);
  optsRef.current = options;

  const MIN_RECORDING_MS = 500;
  const MAX_RECORDING_SEC = 60;

  useEffect(() => {
    setIsSupported(
      !!(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined',
    );
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = undefined; }
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const dur = Date.now() - recordingStartTime.current;
        if (dur < MIN_RECORDING_MS) {
          setError('Recording too short. Hold the button and speak.');
          setStatus('idle');
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 1000) {
          setError('Recording is empty. Please try again.');
          setStatus('idle');
          return;
        }

        setStatus('processing');

        try {
          const token = localStorage.getItem('auth_token');
          const formData = new FormData();
          formData.append('audio', blob, 'recording.webm');
          // stt_only: true → just transcript; false → transcript + agent reply
          formData.append('stt_only', String(optsRef.current.sttOnly ?? true));
          formData.append('language', i18n.language || 'zh');

          const res = await fetch('/api/voice', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Voice recognition failed');
          }

          const json = await res.json();
          const data = json.data;

          if (data?.warning && !data.transcript) {
            setError(data.warning || 'No speech detected. Please try again.');
          } else if (data?.transcript) {
            setTranscript(data.transcript);
            // Fire callback with full result (transcript + optional reply/books)
            if (optsRef.current.onResult) {
              optsRef.current.onResult(data);
            }
          } else {
            setError('No speech detected. Please try again.');
          }
        } catch (err: any) {
          setError(err.message || 'Voice recognition failed');
        } finally {
          setStatus('idle');
        }
      };

      recorder.start();
      recordingStartTime.current = Date.now();
      setDuration(0);

      // Update duration every 100ms, auto-stop at MAX_RECORDING_SEC
      timerRef.current = setInterval(() => {
        const sec = (Date.now() - recordingStartTime.current) / 1000;
        setDuration(sec);
        if (sec >= MAX_RECORDING_SEC) {
          recorder.stop();
        }
      }, 100);

      setStatus('recording');
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone access denied');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else {
        setError(err.message || 'Failed to start recording');
      }
      setStatus('idle');
    }
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = undefined; }
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript(null);
  }, []);

  return {
    status,
    error,
    transcript,
    duration,
    startRecording,
    stopRecording,
    clearTranscript,
    isSupported,
  };
}
