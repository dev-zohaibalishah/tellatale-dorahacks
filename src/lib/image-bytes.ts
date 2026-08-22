/**
 * Reading picked-image bytes, per platform.
 *
 * This looks trivial and is not. `expo-file-system`'s File class is native-only —
 * its web build has no `bytes()` at all — while the web image picker hands back a
 * `blob:` or `data:` URI that the native File class cannot open either. Using one
 * path for both silently produced a zero-byte upload in the browser, which is the
 * failure mode that looks like success right up until the photo renders blank.
 *
 * Web gets a Blob (which supabase-js uploads correctly in a browser); native gets a
 * Uint8Array (Blob and FormData are both unreliable on React Native).
 */

import { Platform } from 'react-native';

export interface ImagePayload {
  body: Blob | Uint8Array;
  contentType: string;
  byteLength: number;
}

function contentTypeFor(uri: string, fallback = 'image/jpeg'): string {
  const dataMatch = /^data:([^;,]+)[;,]/.exec(uri);
  if (dataMatch) return dataMatch[1];
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
    case 'heif':
      return 'image/heic';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    default:
      return fallback;
  }
}

export async function readImageBytes(uri: string): Promise<ImagePayload> {
  if (Platform.OS === 'web') {
    // blob: and data: URIs are both fetchable in a browser; a File object from the
    // picker is already reachable through its object URL.
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error('That image could not be read.');
    }
    const blob = await response.blob();
    if (blob.size === 0) throw new Error('That image is empty.');
    return {
      body: blob,
      contentType: blob.type || contentTypeFor(uri),
      byteLength: blob.size,
    };
  }

  // Native. Imported lazily so the web bundle never pulls in a module whose web
  // build cannot do this job.
  const { File } = await import('expo-file-system');
  const bytes = await new File(uri).bytes();
  if (!bytes || bytes.byteLength === 0) {
    throw new Error('That image is empty.');
  }
  return {
    body: bytes,
    contentType: contentTypeFor(uri),
    byteLength: bytes.byteLength,
  };
}
