import { getStorageProvider } from './factory.js';

const BASE_PREFIX = 'ai-library';

export function buildKey(category: 'books' | 'covers' | 'avatars' | 'pages' | 'tmp', filename: string): string {
  return `${BASE_PREFIX}/${category}/${filename}`;
}

export function keyFromLegacyPath(legacyPath: string): string | null {
  if (!legacyPath || !legacyPath.startsWith('/uploads/')) return null;
  return legacyPath.slice('/uploads/'.length);
}

export function isLegacyPath(value: string | null | undefined): boolean {
  return !!value && value.startsWith('/uploads/');
}

function extractKeyFromUrl(raw: string): string | null {
  // Extract real OSS key from an embedded signed URL (fixes double-encoding bug).
  // Handles raw "://", percent-encoded "%3A//", and nested encodings.
  let idx = raw.indexOf('://');
  let isEncoded = false;
  if (idx === -1) {
    idx = raw.toLowerCase().indexOf('%3a//');
    isEncoded = true;
  }
  if (idx === -1) return null;

  try {
    const urlPart = raw.slice(Math.max(0, idx - 4));
    const decoded = isEncoded ? decodeURIComponent(urlPart) : urlPart;
    const parsed = new URL(decoded);
    if (parsed.searchParams.has('OSSAccessKeyId') || parsed.searchParams.has('Signature')) {
      let key = parsed.pathname.slice(1);
      if (!key) return null;
      const nested = extractKeyFromUrl(key);
      return nested || key;
    }
  } catch { /* not parseable */ }

  return null;
}

export async function resolveFileUrl(
  storedValue: string | null | undefined,
  expiresIn?: number,
): Promise<string | null> {
  if (!storedValue) return null;

  const storage = getStorageProvider();
  const isS3 = process.env.STORAGE_PROVIDER === 's3';
  const defaultExpiry = parseInt(process.env.STORAGE_SIGNED_URL_EXPIRY || '3600', 10);

  // Full URL stored in DB: either an external URL (return as-is) or a signed
  // OSS URL from a previous double-encoding regression (extract key, re-sign).
  if (storedValue.startsWith('http://') || storedValue.startsWith('https://')) {
    const realKey = extractKeyFromUrl(storedValue);
    if (realKey) {
      return storage.getSignedUrl(realKey, expiresIn ?? defaultExpiry);
    }
    return storedValue; // external URL (e.g. Google avatar)
  }

  let key: string;

  if (storedValue.startsWith('/uploads/')) {
    if (!isS3) return storedValue;
    key = `${BASE_PREFIX}/${storedValue.slice('/uploads/'.length)}`;
  } else if (storedValue.startsWith('/')) {
    return storedValue;
  } else if (storedValue.startsWith(`${BASE_PREFIX}/`)) {
    if (!isS3) return `/uploads/${storedValue.slice(BASE_PREFIX.length + 1)}`;
    key = storedValue;
  } else {
    if (!isS3) return `/uploads/${storedValue}`;
    key = `${BASE_PREFIX}/${storedValue}`;
  }

  // Handle embedded signed URL within the key
  const sanitized = extractKeyFromUrl(key);
  if (sanitized) key = sanitized;

  if (process.env.STORAGE_PUBLIC_BASE_URL) {
    const base = process.env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/, '');
    return `${base}/${key}`;
  }

  return storage.getSignedUrl(key, expiresIn ?? defaultExpiry);
}

export async function resolveBookUrls<T extends { fileUrl?: string | null; coverUrl?: string | null }>(
  book: T,
): Promise<T> {
  const imgExpiry = parseInt(process.env.STORAGE_SIGNED_URL_EXPIRY_IMAGES || '86400', 10);
  const fileExpiry = parseInt(process.env.STORAGE_SIGNED_URL_EXPIRY || '3600', 10);

  const resolved: any = { ...book };
  if (book.fileUrl) resolved.fileUrl = await resolveFileUrl(book.fileUrl, fileExpiry);
  if (book.coverUrl) resolved.coverUrl = await resolveFileUrl(book.coverUrl, imgExpiry);
  return resolved;
}

export async function resolveBookListUrls<T extends { fileUrl?: string | null; coverUrl?: string | null }>(
  books: T[],
): Promise<T[]> {
  return Promise.all(books.map(b => resolveBookUrls(b)));
}

export async function resolveUserAvatar(user: { avatar?: string | null; googleAvatar?: string | null }): Promise<typeof user> {
  const imgExpiry = parseInt(process.env.STORAGE_SIGNED_URL_EXPIRY_IMAGES || '86400', 10);
  const resolved: any = { ...user };
  if (user.avatar) resolved.avatar = await resolveFileUrl(user.avatar, imgExpiry);
  if (user.googleAvatar) resolved.googleAvatar = await resolveFileUrl(user.googleAvatar, imgExpiry);
  return resolved;
}
