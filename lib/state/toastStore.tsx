"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ToastItem = {
  id: string;
  message: string;
  variant: "success" | "info";
};

type ToastStoreValue = {
  toasts: ToastItem[];
  vis: (message: string, variant?: ToastItem["variant"]) => void;
  fjern: (id: string) => void;
};

const Ctx = createContext<ToastStoreValue | null>(null);

function nyToastId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `toast-${Date.now()}`;
}

export function ToastStoreProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const fjern = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const vis = useCallback(
    (message: string, variant: ToastItem["variant"] = "info") => {
      const id = nyToastId();
      setToasts((prev) => [...prev, { id, message, variant }]);
      window.setTimeout(() => fjern(id), 6000);
    },
    [fjern],
  );

  const value = useMemo(() => ({ toasts, vis, fjern }), [toasts, vis, fjern]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useToastStore(): ToastStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToastStore må brukes innenfor ToastStoreProvider");
  return ctx;
}
