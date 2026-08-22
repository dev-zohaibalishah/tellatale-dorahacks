/**
 * Adapter selection. One decision, one place.
 *
 * Supabase when a project is configured, on-device AsyncStorage otherwise. Set
 * EXPO_PUBLIC_FORCE_LOCAL=true to pin local mode even with credentials present —
 * useful for demoing on a network you do not trust.
 *
 * The Firebase adapter is gone from this path: Firebase is no longer the database. It
 * now does exactly one job, push delivery, which lives in src/push/.
 */

import { isSupabaseConfigured } from '../supabase/client';
import { createSupabaseRepository } from './supabase-repo';
import { createLocalRepository } from './local-repo';
import type { Repository } from './repository';

const forceLocal = process.env.EXPO_PUBLIC_FORCE_LOCAL === 'true';

export const useLocalBackend = forceLocal || !isSupabaseConfigured;

let instance: Repository | null = null;

export function repository(): Repository {
  if (!instance) {
    instance = useLocalBackend ? createLocalRepository() : createSupabaseRepository();
  }
  return instance;
}

export type { Repository } from './repository';
