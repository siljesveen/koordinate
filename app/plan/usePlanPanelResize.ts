"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "koordinate.plan.panelSizes.v1";

export type PlanPanelSizes = {
  sidebarWidth: number;
  tilgjengeligH: number;
  avspaseringH: number;
  fraværH: number;
};

const DEFAULTS: PlanPanelSizes = {
  sidebarWidth: 280,
  tilgjengeligH: 240,
  avspaseringH: 100,
  fraværH: 100,
};

const LIMITS = {
  sidebarWidth: { min: 200, max: 560 },
  tilgjengeligH: { min: 88, max: 720 },
  avspaseringH: { min: 52, max: 360 },
  fraværH: { min: 52, max: 360 },
} as const;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function loadSizes(): PlanPanelSizes {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const o = JSON.parse(raw) as Partial<PlanPanelSizes>;
    return {
      sidebarWidth: clamp(Number(o.sidebarWidth) || DEFAULTS.sidebarWidth, LIMITS.sidebarWidth.min, LIMITS.sidebarWidth.max),
      tilgjengeligH: clamp(Number(o.tilgjengeligH) || DEFAULTS.tilgjengeligH, LIMITS.tilgjengeligH.min, LIMITS.tilgjengeligH.max),
      avspaseringH: clamp(Number(o.avspaseringH) || DEFAULTS.avspaseringH, LIMITS.avspaseringH.min, LIMITS.avspaseringH.max),
      fraværH: clamp(Number(o.fraværH) || DEFAULTS.fraværH, LIMITS.fraværH.min, LIMITS.fraværH.max),
    };
  } catch {
    return DEFAULTS;
  }
}

export type PlanPanelResizeAxis = keyof PlanPanelSizes;

export function usePlanPanelResize() {
  const [sizes, setSizes] = useState<PlanPanelSizes>(DEFAULTS);
  const sizesRef = useRef(sizes);
  sizesRef.current = sizes;

  useEffect(() => {
    setSizes(loadSizes());
  }, []);

  const persist = useCallback((next: PlanPanelSizes) => {
    sizesRef.current = next;
    setSizes(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const startResize = useCallback(
    (axis: PlanPanelResizeAxis, startEvent: React.PointerEvent<HTMLElement>) => {
      startEvent.preventDefault();
      const startX = startEvent.clientX;
      const startY = startEvent.clientY;
      const start = { ...sizesRef.current };
      const limits = LIMITS[axis];

      function onMove(ev: PointerEvent) {
        const cur = { ...sizesRef.current };
        if (axis === "sidebarWidth") {
          cur.sidebarWidth = clamp(start.sidebarWidth + (startX - ev.clientX), limits.min, limits.max);
        } else if (axis === "tilgjengeligH") {
          cur.tilgjengeligH = clamp(start.tilgjengeligH + (ev.clientY - startY), limits.min, limits.max);
        } else if (axis === "avspaseringH") {
          cur.avspaseringH = clamp(start.avspaseringH + (ev.clientY - startY), limits.min, limits.max);
        } else {
          cur.fraværH = clamp(start.fraværH + (ev.clientY - startY), limits.min, limits.max);
        }
        persist(cur);
      }

      function onUp() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }

      document.body.style.cursor = axis === "sidebarWidth" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [persist],
  );

  return { sizes, startResize };
}
