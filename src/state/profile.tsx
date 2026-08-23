/**
 * Profile — one fetch, one signed URL, shared by every screen that draws the user.
 *
 * The alternative was a `useProfile` hook per screen, and it fails in a specific way:
 * the home header, the Me tab and the editor would each mint their own signed avatar
 * URL, so the same picture would be downloaded three times and — worse — a save on
 * one screen would leave the other two showing the old name until they remounted.
 * Editing your own name and watching the header disagree with you is exactly the kind
 * of small wrongness that makes an app feel unfinished.
 *
 * So state lives here, writes go through here, and everything re-renders together.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { repository } from '../data';
import type { Profile, ProfilePatch } from '../data/repository';
import { useSession } from './auth';

interface ProfileState {
  profile: Profile | null;
  /** Resolved, displayable avatar URL. Null while resolving or when unset. */
  avatarUrl: string | null;
  loading: boolean;
  error: string | null;
  save: (patch: ProfilePatch) => Promise<void>;
  setAvatar: (localImageUri: string) => Promise<void>;
  removeAvatar: () => Promise<void>;
  reload: () => void;
}

const Ctx = createContext<ProfileState | null>(null);

function message(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.';
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { uid, username, displayName, ready } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  /* ------------------------------------------------------------ the row */

  useEffect(() => {
    if (!ready) return;
    if (!uid) {
      setProfile(null);
      setAvatarUrl(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setError(null);
    // Only spin when there is nothing on screen. A refetch that blanks an already
    // drawn header reads as a sign-out, not as a refresh.
    setProfile((p) => {
      if (!p) setLoading(true);
      return p;
    });

    repository()
      .getProfile(uid)
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        // A failed profile read must not blank the identity everywhere. The session
        // still knows who this is, so fall back to it rather than rendering nobody.
        setProfile((prev) => prev ?? null);
        setError(message(e));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uid, ready, nonce]);

  /* --------------------------------------------------------- the picture */

  // Signed URLs expire. Tracking the path this URL was minted for means a re-render
  // does not re-mint, but a genuine change of picture does.
  const mintedFor = useRef<string | null>(null);

  useEffect(() => {
    const path = profile?.avatarPath ?? null;
    if (!path) {
      mintedFor.current = null;
      setAvatarUrl(null);
      return;
    }
    // Already minted for this exact path — including a path that failed, which is
    // recorded below precisely so it is not retried on every render.
    if (mintedFor.current === path) return;

    let cancelled = false;
    repository()
      .avatarUrl(path)
      .then((url) => {
        if (cancelled) return;
        mintedFor.current = path;
        setAvatarUrl(url);
      })
      .catch(() => {
        // A missing object is not worth an error banner — the initial-letter avatar
        // is a complete fallback, and the row is still correct.
        //
        // Marking the path as attempted matters: without it, the null result re-runs
        // this effect, which retries, which fails, which sets null again. A dead
        // object would have the app minting signed URLs in a tight loop forever.
        if (cancelled) return;
        mintedFor.current = path;
        setAvatarUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [profile?.avatarPath]);

  /* ------------------------------------------------------------- writes */

  const save = useCallback(
    async (patch: ProfilePatch) => {
      if (!uid) throw new Error('You are not signed in.');
      const saved = await repository().updateProfile(uid, patch);
      setProfile(saved);
    },
    [uid]
  );

  const setAvatar = useCallback(
    async (localImageUri: string) => {
      if (!uid) throw new Error('You are not signed in.');
      const saved = await repository().setAvatar(uid, localImageUri);
      setProfile(saved);
    },
    [uid]
  );

  const removeAvatar = useCallback(async () => {
    if (!uid) throw new Error('You are not signed in.');
    const saved = await repository().removeAvatar(uid);
    setProfile(saved);
  }, [uid]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  /**
   * The session is the fallback, not the source. Its copy comes from Auth metadata,
   * which the adapter mirrors on every save — so it is right often enough to render
   * from while the row is still in flight, and never right enough to prefer.
   */
  const value = useMemo<ProfileState>(
    () => ({
      profile: profile ?? (uid ? fallbackProfile(uid, username, displayName) : null),
      avatarUrl,
      loading,
      error,
      save,
      setAvatar,
      removeAvatar,
      reload,
    }),
    [
      profile,
      uid,
      username,
      displayName,
      avatarUrl,
      loading,
      error,
      save,
      setAvatar,
      removeAvatar,
      reload,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function fallbackProfile(
  uid: string,
  username: string | null,
  displayName: string | null
): Profile {
  return {
    uid,
    username: username ?? '',
    displayName: displayName ?? null,
    bio: null,
    location: null,
    avatarPath: null,
    createdAt: Date.now(),
  };
}

export function useProfile(): ProfileState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProfile must be used inside <ProfileProvider>');
  return v;
}

/** The name to draw, in the order the product prefers it. */
export function nameFor(p: Profile | null): string {
  return p?.displayName?.trim() || p?.username || 'You';
}
