import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/auth.js';
import { transcribeAudio } from '../services/stt.js';
import { runBookAgent } from '../services/bookAgent.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Unsupported audio format'));
    }
  },
});

router.post('/voice', verifyToken, upload.single('audio'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'Audio file is required' });
      return;
    }

    const audioBuffer = req.file.buffer;
    const mimeType = req.file.mimetype || 'audio/webm';
    const sttOnly = req.body.stt_only === 'true' || req.body.stt_only === true;

    if (audioBuffer.length === 0) {
      res.status(400).json({ success: false, error: 'Audio data is empty' });
      return;
    }

    const t0 = Date.now();
    const transcript = await transcribeAudio(audioBuffer, mimeType);
    const elapsed = Date.now() - t0;

    console.log(`[VOICE] ${req.user?.userId} transcript (${elapsed}ms): "${transcript.slice(0, 80)}"`);

    if (!transcript) {
      res.json({ success: true, data: { transcript: '', warning: 'No speech detected' } });
      return;
    }

    // stt_only: return transcript only — caller handles agent
    if (sttOnly) {
      res.json({ success: true, data: { transcript } });
      return;
    }

    // Full pipeline: transcribe → agent → reply + books（对标 wuye voice router）
    try {
      const agentResult = await runBookAgent(transcript);
      res.json({
        success: true,
        data: {
          transcript,
          reply: agentResult.message,
          books: agentResult.books,
        },
      });
    } catch (agentErr: any) {
      console.error('[VOICE] Agent error:', agentErr.message);
      // Still return the transcript even if agent fails
      res.json({
        success: true,
        data: {
          transcript,
          reply: '',
          warning: 'Agent processing failed',
        },
      });
    }
  } catch (error: any) {
    console.error('[VOICE] STT error:', error.message);
    const msg = error.message || '';
    if (msg.includes('ffmpeg') || msg.includes('EBML') || msg.includes('Invalid data')) {
      res.status(400).json({ success: false, error: 'Audio recording is corrupted. Please try again.' });
    } else if (msg.includes('API key') || msg.includes('401') || msg.includes('403')) {
      res.status(500).json({ success: false, error: 'Voice service configuration error.' });
    } else {
      res.status(500).json({ success: false, error: 'Speech recognition failed. Please try again.' });
    }
  }
});

export default router;
