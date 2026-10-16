import { useEffect, useState } from 'react';
import api from '@/lib/api';

const imageCache = new Map<string, string>();

export function getUploadFilename(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  return filePath.split(/[\\/]/).pop() ?? null;
}

export function useAuthenticatedImageUrl(filePath: string | null | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!filePath) {
      setUrl(undefined);
      return;
    }

    const cached = imageCache.get(filePath);
    if (cached) {
      setUrl(cached);
      return;
    }

    let cancelled = false;
    const filename = getUploadFilename(filePath);
    if (!filename) {
      setUrl(undefined);
      return;
    }

    setUrl(undefined);

    api
      .get(`/uploads/${filename}`, { responseType: 'blob' })
      .then((response) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(new Blob([response.data]));
        imageCache.set(filePath, objectUrl);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  // Never expose a cached URL when the path was cleared (e.g. after delete + save).
  return filePath ? url : undefined;
}

export function invalidateAuthenticatedImage(filePath: string | null | undefined) {
  if (!filePath) return;
  const cached = imageCache.get(filePath);
  if (cached) {
    URL.revokeObjectURL(cached);
    imageCache.delete(filePath);
  }
}
