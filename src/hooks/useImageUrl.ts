import { useEffect, useState } from 'react';

import { repository } from '../data';

export interface ResolvedImage {
  /** Displayable URL, or null while resolving and after a failure. */
  url: string | null;
  /** True only once resolution has genuinely failed. */
  failed: boolean;
}

/**
 * Resolves a stored image path to a displayable URL.
 *
 * Local mode returns the picker URI unchanged; Supabase mints a short-lived signed
 * URL. Keeping this behind a hook means no screen has to know which backend it is on.
 *
 * It returns a status alongside the URL rather than just the URL, and that is the
 * whole point of the shape. A bare `string | null` collapses two states that have to
 * be drawn differently — "the URL is on its way" and "there will never be a URL" —
 * into the same null, so every consumer was forced to guess which one it had. They
 * guessed wrong, and photographs that were merely slow were captioned as broken.
 */
export function useImageUrl(path: string | null | undefined): ResolvedImage {
  const [state, setState] = useState<ResolvedImage>({ url: null, failed: false });

  useEffect(() => {
    let cancelled = false;

    if (!path) {
      // No path is not a failure — a memory still loading has no path yet either.
      setState({ url: null, failed: false });
      return;
    }

    setState({ url: null, failed: false });
    repository()
      .imageUrl(path)
      .then((u) => {
        if (!cancelled) setState({ url: u, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ url: null, failed: true });
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return state;
}
