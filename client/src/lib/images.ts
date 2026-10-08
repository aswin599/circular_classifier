import api from './api';

/**
 * Fetch an authenticated-protected binary endpoint and resolve to an object
 * URL that can be used directly in `<img>` tags. Callers must revoke the URL
 * with `URL.revokeObjectURL` when done.
 */
export async function fetchImageBlobUrl(pathOrUrl: string): Promise<string> {
  const url = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl.replace(/^\/+/, '')}`;
  const response = await api.get(url, { responseType: 'blob' });
  const blob = response.data as Blob;
  if (!blob || blob.size === 0) {
    throw new Error('Empty image response');
  }
  return URL.createObjectURL(blob);
}