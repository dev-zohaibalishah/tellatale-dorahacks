/**
 * Dashboard data.
 *
 * Each hook owns one query and exposes `{ data, loading, error, reload }`. Screens do
 * not orchestrate loading order, because a dashboard that waits for its slowest
 * section before showing any of them feels broken on a slow connection — each panel
 * arrives when it is ready.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { repository } from '../data';
import type { Collection, DashboardSummary, SharedMemory } from '../data/repository';

/**
 * Refetches whenever the screen comes back into focus.
 *
 * Without this, creating a collection in a modal and returning leaves the dashboard
 * showing its empty state over a row that already exists in the database — the write
 * succeeded and the interface silently disagreed. Dismissing a modal is not a
 * navigation event these queries would otherwise hear about.
 */
export function useReloadOnFocus(reloaders: (() => void)[]) {
  useFocusEffect(
    useCallback(() => {
      reloaders.forEach((r) => r());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, reloaders)
  );
}

interface Async<T> {
  data: T;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function useAsync<T>(
  run: () => Promise<T>,
  initial: T,
  deps: unknown[],
  enabled = true
): Async<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    run()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'That could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}

export function useCollections(uid: string | null) {
  return useAsync<Collection[]>(
    () => repository().listCollections(uid!),
    [],
    [uid],
    Boolean(uid)
  );
}

export function useSharedWithMe(uid: string | null) {
  return useAsync<SharedMemory[]>(
    () => repository().listSharedWithMe(uid!),
    [],
    [uid],
    Boolean(uid)
  );
}

const EMPTY_SUMMARY: DashboardSummary = {
  memoriesOwned: 0,
  contributorsTotal: 0,
  storiesApproved: 0,
  storiesPublished: 0,
  collectionsCount: 0,
  sharedWithMe: 0,
};

export function useDashboardSummary(uid: string | null) {
  return useAsync<DashboardSummary>(
    () => repository().dashboardSummary(uid!),
    EMPTY_SUMMARY,
    [uid],
    Boolean(uid)
  );
}

export function useMemoryCollections(memoryId: string | undefined) {
  return useAsync<string[]>(
    () => repository().collectionsForMemory(memoryId!),
    [],
    [memoryId],
    Boolean(memoryId)
  );
}
