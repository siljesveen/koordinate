"use client";

/**
 * Sentral klient-motor for app-data.
 * Alle brukerendringer: patchAppData → localStorage → dirty → abonnenter → debounced sky.
 * Sky/live-sync: applyRemoteAppDataKey (respekterer dirty).
 */
import { saveAppData } from "@/lib/data/appDataStorage";
import { isKeyDirty, markKeyClean, markKeyDirty } from "@/lib/data/dirtyKeys";
import { setKeyMeta } from "@/lib/data/syncMeta";
import type { AppDataKey } from "@/lib/data/storageKeys";

const SKY_SAVE_MS = 500;

type KeyListener = () => void;

const listeners = new Map<string, Set<KeyListener>>();
const keyVersions = new Map<string, number>();
const skySaveTimers = new Map<string, number>();
const pendingSkyValues = new Map<string, unknown>();

function lesLocal(key: string): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function skrivLocal(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / privat modus
  }
}

function bumpKeyVersion(key: string): void {
  keyVersions.set(key, (keyVersions.get(key) ?? 0) + 1);
}

function notifyKeyListeners(key: string): void {
  bumpKeyVersion(key);
  const set = listeners.get(key);
  if (!set) return;
  for (const fn of set) {
    try {
      fn();
    } catch (err) {
      console.error("[appDataEngine] listener feilet:", key, err);
    }
  }
}

function scheduleSkySave(key: AppDataKey, value: unknown, canEdit: boolean): void {
  pendingSkyValues.set(key, value);
  const existing = skySaveTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = window.setTimeout(() => {
    skySaveTimers.delete(key);
    const latest = pendingSkyValues.get(key);
    pendingSkyValues.delete(key);
    if (latest === undefined) return;
    void saveAppData(key, latest, canEdit);
  }, SKY_SAVE_MS);

  skySaveTimers.set(key, timer);
}

/** Synkron les fra localStorage — eneste lesekilde etter innlogging. */
export function readAppDataLocal(key: AppDataKey): unknown | null {
  return lesLocal(key);
}

/** Abonner på endringer for én nøkkel (lokal patch eller trygg sky-oppdatering). */
export function subscribeAppDataKey(key: AppDataKey, listener: KeyListener): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) listeners.delete(key);
  };
}

export function getAppDataKeyVersion(key: AppDataKey): number {
  return keyVersions.get(key) ?? 0;
}

/** Varsle abonnenter for én eller flere nøkler (f.eks. etter sky-sync). */
export function notifyAppDataKeysUpdated(keys: readonly string[]): void {
  for (const key of keys) {
    notifyKeyListeners(key);
  }
}

export type PatchAppDataOptions = {
  canEdit: boolean;
  /** Hopp over debounced sky-lagring (f.eks. ved bulk-import). */
  skipSky?: boolean;
};

/**
 * Eneste skrivevei for app-data i klienten:
 * les → oppdater → skriv localStorage med én gang → merk dirty → varsle abonnenter → debounced sky.
 */
export function patchAppData<T>(
  key: AppDataKey,
  updater: (previous: T | null) => T,
  options: PatchAppDataOptions,
): T {
  if (!options.canEdit) {
    return updater(lesLocal(key) as T | null);
  }

  const previous = lesLocal(key) as T | null;
  const next = updater(previous);
  skrivLocal(key, next);
  markKeyDirty(key);
  notifyKeyListeners(key);

  if (!options.skipSky) {
    scheduleSkySave(key, next, options.canEdit);
  }

  return next;
}

/** Sky/live-sync: skriv cache og varsle kun når nøkkelen ikke er dirty. */
export function applyRemoteAppDataKey(
  key: AppDataKey,
  value: unknown,
  updatedAt: string,
): boolean {
  if (isKeyDirty(key)) return false;
  skrivLocal(key, value);
  setKeyMeta(key, updatedAt);
  markKeyClean(key);
  notifyKeyListeners(key);
  return true;
}

/** Erstatt hele verdien lokalt (samme som patch uten transform). */
export function replaceAppDataLocal<T>(
  key: AppDataKey,
  value: T,
  options: PatchAppDataOptions,
): T {
  return patchAppData(key, () => value, options);
}
