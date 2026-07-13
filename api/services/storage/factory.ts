import type { StorageProvider } from './interface.js';
import { S3StorageProvider } from './s3Provider.js';
import { LocalStorageProvider } from './localProvider.js';

let provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (provider) return provider;

  const type = process.env.STORAGE_PROVIDER || 'local';

  if (type === 's3') {
    provider = new S3StorageProvider({
      endpoint: process.env.STORAGE_S3_ENDPOINT || '',
      region: process.env.STORAGE_S3_REGION || '',
      bucket: process.env.STORAGE_S3_BUCKET || '',
      accessKey: process.env.STORAGE_S3_ACCESS_KEY || '',
      secretKey: process.env.STORAGE_S3_SECRET_KEY || '',
      forcePathStyle: process.env.STORAGE_S3_FORCE_PATH_STYLE === 'true',
      publicEndpoint: process.env.STORAGE_S3_PUBLIC_ENDPOINT || undefined,
    });
  } else {
    provider = new LocalStorageProvider();
  }

  return provider;
}
