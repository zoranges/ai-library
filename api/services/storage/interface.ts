export interface StorageProvider {
  upload(key: string, body: Buffer, contentType: string, metadata?: Record<string, string>): Promise<string>;
  delete(key: string): Promise<void>;
  deleteMultiple(keys: string[]): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  getObject(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  listObjects(prefix: string): Promise<string[]>;
}
