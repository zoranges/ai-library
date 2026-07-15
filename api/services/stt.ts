import { execFile } from 'child_process';
import { ChatOpenAI } from '@langchain/openai';

// ── Types ──

export interface STTConfig {
  apiKey: string;
  model: string;
  baseURL: string;
}

export interface AudioConverter {
  convert(audioBuffer: Buffer, mimeType: string): Promise<Buffer>;
}

export interface STTProvider {
  readonly name: string;
  transcribe(audioBuffer: Buffer, mimeType: string): Promise<string>;
}

// ── FFmpeg Audio Converter ──

class FFmpegConverter implements AudioConverter {
  async convert(audioBuffer: Buffer, _mimeType: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const ffmpeg = execFile(
        'ffmpeg',
        [
          '-i', 'pipe:0',
          '-f', 'wav',
          '-acodec', 'pcm_s16le',
          '-ar', '16000',
          '-ac', '1',
          'pipe:1',
        ],
        {
          timeout: 30000,
          maxBuffer: 50 * 1024 * 1024,
        },
      );

      if (!ffmpeg.stdin || !ffmpeg.stdout) {
        reject(new Error('Failed to start ffmpeg'));
        return;
      }

      ffmpeg.stdout.setEncoding(null);

      const chunks: Buffer[] = [];
      let stderr = '';

      ffmpeg.stdout.on('data', (chunk: Buffer | string) => {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      });
      ffmpeg.stderr?.on('data', (data: Buffer | string) => {
        stderr += typeof data === 'string' ? data : data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-200)}`));
          return;
        }
        resolve(Buffer.concat(chunks));
      });

      ffmpeg.on('error', (err) => reject(new Error(`ffmpeg error: ${err.message}`)));

      ffmpeg.stdin.write(audioBuffer);
      ffmpeg.stdin.end();
    });
  }
}

// ── Aliyun (DashScope) STT Provider ──

class AliyunSTTProvider implements STTProvider {
  readonly name = 'aliyun';
  private config: STTConfig;
  private converter: AudioConverter;

  constructor(config: STTConfig, converter?: AudioConverter) {
    this.config = config;
    this.converter = converter || new FFmpegConverter();
  }

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Audio data is empty');
    }

    const t0 = Date.now();

    const wavBuffer = await this.converter.convert(audioBuffer, mimeType);
    console.log(`[STT:${this.name}] converted ${audioBuffer.length}B ${mimeType} → ${wavBuffer.length}B WAV`);

    const audioBase64 = wavBuffer.toString('base64');
    const dataUri = `data:audio/wav;base64,${audioBase64}`;

    const model = new ChatOpenAI({
      modelName: this.config.model,
      temperature: 0,
      configuration: {
        baseURL: this.config.baseURL,
        apiKey: this.config.apiKey,
      },
    });

    const response = await model.invoke([
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: { data: dataUri },
          },
        ],
      },
    ]);

    const transcript = typeof response.content === 'string'
      ? response.content
      : Array.isArray(response.content)
        ? response.content.map((c: any) => c.text || '').join('')
        : '';

    const elapsed = Date.now() - t0;
    console.log(`[STT:${this.name}] transcript (${elapsed}ms): "${transcript.slice(0, 80)}"`);

    return transcript.trim();
  }
}

// ── Factory ──

const STT_CONFIG: STTConfig = {
  apiKey: process.env.STT_API_KEY || process.env.ALIBABA_API_KEY || '',
  model: process.env.STT_MODEL || 'qwen3-asr-flash',
  baseURL: process.env.STT_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
};

// Provider registry — extend with 'azure', 'google', etc.
const providerRegistry: Record<string, (config: STTConfig) => STTProvider> = {
  aliyun: (config) => new AliyunSTTProvider(config),
};

export function createSTTProvider(provider?: string): STTProvider {
  const name = provider || process.env.STT_PROVIDER || 'aliyun';
  const factory = providerRegistry[name];
  if (!factory) {
    throw new Error(
      `Unknown STT provider: ${name}. Available: ${Object.keys(providerRegistry).join(', ')}`,
    );
  }
  return factory(STT_CONFIG);
}

// Lazy singleton — reuse across requests
let _provider: STTProvider | null = null;
function getSTTProvider(): STTProvider {
  if (!_provider) {
    _provider = createSTTProvider();
  }
  return _provider;
}

// Convenience export (backward compatible)
export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  return getSTTProvider().transcribe(audioBuffer, mimeType);
}
