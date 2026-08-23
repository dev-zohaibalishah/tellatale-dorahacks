/**
 * Subscription hooks over the repository.
 *
 * Every one of these returns `{ data, loading, error }` rather than a bare value,
 * because "nothing yet" and "nothing, confirmed" have to render differently — an
 * empty state shown during the first frame of a load looks like data loss, and it is
 * the single most common way an otherwise finished app feels broken.
 *
 * Screens never import the adapters directly; that is what keeps the Firebase-vs-
 * Express backend decision a one-file change. See src/data/repository.ts.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { repository } from '../data';
import type { AppNotification, GuestMemoryView } from '../data/repository';
import type { Memory, Remark, StoryDoc } from '../../shared/story';

export interface Async<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.';
}

export function useMemories(uid: string | null): Async<Memory[]> {
  const [state, setState] = useState<Async<Memory[]>>({
    data: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!uid) {
      // No session. Resolve rather than sit on a spinner — if anonymous sign-in is
      // disabled on the project, an endless skeleton is the least useful thing to
      // show the person trying to work out why.
      setState({
        data: [],
        loading: false,
        error: 'No session yet. Check that anonymous sign-in is enabled.',
      });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      return repository().watchMemories(uid, (memories) =>
        setState({ data: memories, loading: false, error: null })
      );
    } catch (e) {
      setState({ data: [], loading: false, error: message(e) });
      return;
    }
  }, [uid]);

  return state;
}

export function useMemory(id: string | undefined): Async<Memory | null> & {
  reload: () => void;
} {
  const [state, setState] = useState<Async<Memory | null>>({
    data: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!id) {
      setState({ data: null, loading: false, error: 'No memory was requested.' });
      return;
    }
    let cancelled = false;
    // Only show a loading state when there is nothing to show. A refetch that blanks
    // an already-rendered page reads as a crash, not as a refresh.
    setState((s) => ({ ...s, loading: s.data === null }));
    repository()
      .getMemory(id)
      .then((memory) => {
        if (cancelled) return;
        setState({
          data: memory,
          loading: false,
          error: memory ? null : 'That memory no longer exists.',
        });
      })
      .catch((e) => {
        if (!cancelled) setState({ data: null, loading: false, error: message(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [id, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  /**
   * The memory document is fetched, not watched — the repository interface exposes
   * `watchMemories` for the library but only `getMemory` for one. That is fine until
   * a sibling screen changes it: approving a story or flipping visibility happens on
   * another route, and coming back to a stale "Approve the story first" toggle is a
   * dead end the user cannot get out of without restarting the app. Refetching on
   * focus closes that gap without widening the data contract.
   */
  const mounted = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (mounted.current) reload();
      mounted.current = true;
    }, [reload])
  );

  return { ...state, reload };
}

/**
 * Remarks, watched — with a way to ask again.
 *
 * A watch* hook reads as a promise that the list keeps itself current, and for
 * months it did not: the realtime publication was empty, so these subscriptions
 * delivered nothing and the only thing refreshing the list was the fetch on mount.
 * Including or excluding a remark writes to the database and then waits for an echo
 * that never arrives, so the switch the owner just flipped stays where it was.
 *
 * The publication is fixed, but a screen whose correctness depends on a websocket
 * being healthy is a screen that breaks on a train. reload() makes the live path an
 * optimisation rather than the only one.
 */
export function useRemarks(memoryId: string | undefined): Async<Remark[]> & {
  reload: () => void;
} {
  const [state, setState] = useState<Async<Remark[]>>({
    data: [],
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!memoryId) return;
    try {
      return repository().watchRemarks(memoryId, (remarks) =>
        setState({ data: remarks, loading: false, error: null })
      );
    } catch (e) {
      setState({ data: [], loading: false, error: message(e) });
      return;
    }
  }, [memoryId, nonce]);

  return { ...state, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

/** Same bargain as useRemarks: live when the socket is healthy, correct regardless. */
export function useStory(memoryId: string | undefined): Async<StoryDoc | null> & {
  reload: () => void;
} {
  const [state, setState] = useState<Async<StoryDoc | null>>({
    data: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!memoryId) return;
    try {
      return repository().watchStory(memoryId, (story) =>
        setState({ data: story, loading: false, error: null })
      );
    } catch (e) {
      setState({ data: null, loading: false, error: message(e) });
      return;
    }
  }, [memoryId, nonce]);

  return { ...state, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

/**
 * Re-exported, not redefined. `useImageUrl` already exists as its own module; having
 * a second copy here would give two implementations of the same resolution rule and
 * a coin-flip over which one a screen imports. Screens can keep importing everything
 * repository-shaped from this one file.
 *
 * `null` while resolving is meaningful — PhotoPlate holds the space rather than
 * collapsing the layout under content that has already been read.
 */
export { useImageUrl } from './useImageUrl';

/** The guest's view of a memory, fetched by invite token. */
export function useGuestMemory(token: string | undefined): Async<GuestMemoryView | null> & {
  reload: () => void;
} {
  const [state, setState] = useState<Async<GuestMemoryView | null>>({
    data: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!token) {
      setState({ data: null, loading: false, error: 'This link is not valid.' });
      return;
    }
    let cancelled = false;
    // Same rule as useMemory — a guest who has just submitted must not have the
    // thank-you screen replaced by a spinner while the count refreshes behind it.
    setState((s) => ({ ...s, loading: s.data === null }));
    repository()
      .getGuestMemory(token)
      .then((view) => !cancelled && setState({ data: view, loading: false, error: null }))
      .catch((e) => {
        if (!cancelled) setState({ data: null, loading: false, error: message(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [token, nonce]);

  return { ...state, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

/**
 * The owner's notification feed, live.
 *
 * Watched rather than fetched for the same reason remarks are: a contribution
 * arriving from someone else's phone should reach the bell while the owner is
 * holding theirs.
 */
export function useNotifications(uid: string | null): Async<AppNotification[]> {
  const [state, setState] = useState<Async<AppNotification[]>>({
    data: [],
    loading: true,
    error: null,
  });

  /**
   * Realtime is the fast path, not the only one.
   *
   * postgres_changes delivery depends on the table being in the supabase_realtime
   * publication and on the socket carrying a valid token — infrastructure that fails
   * silently when it is wrong, which is exactly how this app shipped for weeks with
   * an empty publication and four subscriptions that never fired. Re-subscribing on
   * focus means the unread badge is correct every time the screen is looked at, and
   * realtime only decides whether it is also correct in between.
   */
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (mounted.current) setNonce((n) => n + 1);
      mounted.current = true;
    }, [])
  );

  useEffect(() => {
    if (!uid) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    try {
      return repository().watchNotifications(uid, (items) =>
        setState({ data: items, loading: false, error: null })
      );
    } catch (e) {
      setState({ data: [], loading: false, error: message(e) });
      return;
    }
  }, [uid, nonce]);

  return state;
}
