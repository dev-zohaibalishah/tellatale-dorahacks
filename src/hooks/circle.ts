/**
 * Circle, requests, faces and flashbacks.
 *
 * Same `{ data, loading, error, reload }` shape as the rest of the app, for the same
 * reason: "nothing yet" and "nothing, confirmed" have to render differently, and an
 * empty state shown during the first frame of a load reads as data loss.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { repository } from '../data';
import type {
  Circle,
  CircleMember,
  FaceName,
  MemoryRequest,
  RequestAnswer,
} from '../data/repository';
import type { Memory } from '../../shared/story';

export interface Async<T> {
  data: T;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : 'That could not be loaded.';
}

function useAsync<T>(run: () => Promise<T>, initial: T, deps: unknown[], enabled = true): Async<T> {
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
      .then((r) => {
        if (cancelled) return;
        setData(r);
        setError(null);
      })
      .catch((e: unknown) => !cancelled && setError(message(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  return { data, loading, error, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

export function useCircle(uid: string | null) {
  const state = useAsync<Circle | null>(() => repository().getCircle(uid!), null, [uid], Boolean(uid));

  // Creating a circle, joining one, or renaming it all happen on other screens.
  // Refetching on focus keeps the family name in the home header honest.
  const { reload } = state;
  useFocusEffect(useCallback(() => reload(), [reload]));

  return state;
}

export function useMembers(circleId: string | undefined) {
  return useAsync<CircleMember[]>(
    () => repository().listMembers(circleId!),
    [],
    [circleId],
    Boolean(circleId)
  );
}

export function useRequests(circleId: string | undefined) {
  const state = useAsync<MemoryRequest[]>(
    () => repository().listRequests(circleId!),
    [],
    [circleId],
    Boolean(circleId)
  );
  const { reload } = state;
  useFocusEffect(useCallback(() => reload(), [reload]));
  return state;
}

export function useAnswers(requestId: string | undefined) {
  return useAsync<RequestAnswer[]>(
    () => repository().listAnswers(requestId!),
    [],
    [requestId],
    Boolean(requestId)
  );
}

export function useFaceNames(memoryId: string | undefined) {
  return useAsync<FaceName[]>(
    () => repository().listFaceNames(memoryId!),
    [],
    [memoryId],
    Boolean(memoryId)
  );
}

/* --------------------------------------------------------------- flashbacks */

export interface Flashback {
  memory: Memory;
  year: number;
  yearsAgo: number;
}

/** Pull a 4-digit year out of free text; null when there is not one to find. */
function yearOf(hint: string | null): number | null {
  if (!hint) return null;
  const match = /\b(1[89]\d{2}|20\d{2})\b/.exec(hint);
  return match ? Number(match[1]) : null;
}

/**
 * "On this day, 30 years ago."
 *
 * Derived, not stored. `date_hint` is free text by design — "Summer 1994", "around
 * 1979" — so a flashback is whatever a year can be read out of it, and a memory whose
 * date nobody remembers simply does not produce one. Nothing here invents a date to
 * make the shelf look fuller.
 *
 * Deliberately not literally "on this day": these dates are years, not days, and
 * pretending to know the day would be a precision the data does not have.
 */
export function useFlashbacks(memories: Memory[]): Flashback[] {
  return useMemo(() => {
    const thisYear = new Date().getFullYear();
    return memories
      .map((memory) => {
        const year = yearOf(memory.dateHint);
        if (year === null) return null;
        const yearsAgo = thisYear - year;
        // A memory from this year is not a look-back.
        if (yearsAgo < 1) return null;
        return { memory, year, yearsAgo };
      })
      .filter((f): f is Flashback => f !== null)
      .sort((a, b) => b.yearsAgo - a.yearsAgo);
  }, [memories]);
}
