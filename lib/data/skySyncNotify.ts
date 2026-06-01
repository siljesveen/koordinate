export type SkySyncNotice =
  | { type: "applied"; keys: string[]; at: number }
  | { type: "skipped_dirty"; keys: string[]; at: number }
  | { type: "conflict"; key: string; at: number };

export type SkySyncNoticeInput =
  | { type: "applied"; keys: string[] }
  | { type: "skipped_dirty"; keys: string[] }
  | { type: "conflict"; key: string };

type Listener = (notice: SkySyncNotice) => void;

const listeners = new Set<Listener>();

export function onSkySyncNotice(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reportSkySyncNotice(notice: SkySyncNoticeInput): void {
  const full = { ...notice, at: Date.now() } as SkySyncNotice;
  for (const listener of listeners) {
    listener(full);
  }
}
