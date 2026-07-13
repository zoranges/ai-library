import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { StorageProvider } from './interface.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '..', '..', '..', 'uploads');

export class LocalStorageProvider implements StorageProvider {
  private resolvePath(key: string): string {
    return path.join(UPLOADS_ROOT, key);
  }

  async upload(key: string, body: Buffer, _contentType: string, _metadata?: Record<string, string>): Promise<string> {
    const fullPath = this.resolvePath(key);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, body);
    return key;
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolvePath(key);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }

  async deleteMultiple(keys: string[]): Promise<void> {
    for (const key of keys) await this.delete(key);
  }

  async getSignedUrl(key: string, _expiresInSeconds: number): Promise<string> {
    return `/uploads/${key}`;
  }

  async getObject(key: string): Promise<Buffer> {
    return fs.readFileSync(this.resolvePath(key));
  }

  async exists(key: string): Promise<boolean> {
    return fs.existsSync(this.resolvePath(key));
  }

  async listObjects(prefix: string): Promise<string[]> {
    const dir = path.join(UPLOADS_ROOT, prefix);
    if (!fs.existsSync(dir)) return [];
    const results: string[] = [];
    const walk = (currentDir: string, basePrefix: string) => {
      for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
        const rel = path.join(basePrefix, entry.name);
        if (entry.isDirectory()) {
          walk(path.join(currentDir, entry.name), rel);
        } else {
          results.push(rel);
        }
      }
    };
    walk(dir, prefix);
    return results;
  }
}
