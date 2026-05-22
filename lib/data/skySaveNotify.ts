export type SkySaveResult = {
  key: string;
  savedToSky: boolean;
  error?: string;
};

type Listener = (result: SkySaveResult) => void;

const listeners = new Set<Listener>();

export function onSkySave(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reportSkySave(result: SkySaveResult): void {
  for (const listener of listeners) {
    listener(result);
  }
}
