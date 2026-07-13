import OSS from 'ali-oss';
import * as AgentKeepalive from 'agentkeepalive';
import type { StorageProvider } from './interface.js';

const HttpsAgentKeepalive = AgentKeepalive.HttpsAgent;

const sharedHttpsAgent = new HttpsAgentKeepalive({
  keepAlive: true,
  maxSockets: 20,
  maxFreeSockets: 10,
  freeSocketKeepAliveTimeout: 120000,  // keep idle sockets alive 120s
  timeout: 240000,                      // socket inactivity timeout
});

export class S3StorageProvider implements StorageProvider {
  private store: OSS;
  private signEndpoint: string;

  constructor(config: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    forcePathStyle?: boolean;
    publicEndpoint?: string;
  }) {
    this.signEndpoint = (config.publicEndpoint || '').replace(/\/$/, '');

    this.store = new OSS({
      region: config.region,
      accessKeyId: config.accessKey,
      accessKeySecret: config.secretKey,
      bucket: config.bucket,
      secure: true,
      timeout: 600_000,
      httpsAgent: sharedHttpsAgent,
    });
  }

  async upload(key: string, body: Buffer, contentType: string, metadata?: Record<string, string>): Promise<string> {
    const headers: Record<string, string> = { 'Content-Type': contentType };
    if (metadata) {
      for (const [k, v] of Object.entries(metadata)) {
        headers[`x-oss-meta-${k}`] = v;
      }
    }
    await this.store.put(key, body, { headers });
    return key;
  }

  async delete(key: string): Promise<void> {
    await this.store.delete(key);
  }

  async deleteMultiple(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.store.deleteMulti(keys, { quiet: true });
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    if (this.signEndpoint) {
      const signClient = new OSS({
        accessKeyId: (this.store as any).options.accessKeyId,
        accessKeySecret: (this.store as any).options.accessKeySecret,
        bucket: (this.store as any).options.bucket,
        endpoint: this.signEndpoint,
        httpsAgent: sharedHttpsAgent,
      });
      return signClient.signatureUrl(key, { expires: expiresInSeconds });
    }
    return this.store.signatureUrl(key, { expires: expiresInSeconds });
  }

  async getObject(key: string): Promise<Buffer> {
    const result = await this.store.get(key);
    return result.content as Buffer;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.store.head(key);
      return true;
    } catch (err: any) {
      if (err.code === 'NoSuchKey' || err.status === 404) return false;
      throw err;
    }
  }

  async listObjects(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let marker: string | undefined;
    do {
      const result = await this.store.list({ prefix, marker, 'max-keys': 1000 }, {});
      for (const obj of result.objects || []) {
        if (obj.name) keys.push(obj.name);
      }
      marker = result.nextMarker || undefined;
    } while (marker);
    return keys;
  }
}
