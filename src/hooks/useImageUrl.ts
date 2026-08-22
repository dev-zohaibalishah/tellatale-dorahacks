import { useEffect, useState } from 'react';

import { repository } from '../data';

/**
 * Resolves a stored image path to a displayable URL.
 *
 * Local mode returns the picker URI unchanged; Firebase mode issues a download URL.
 * Keeping this behind a hook means no screen has to know which backend it is on, and
 * it is the natural place to add caching or a signed-URL refresh later.
 */
export function useImageUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    repository()
      .imageUrl(path)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}
