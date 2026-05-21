"use client";

import { useEffect, useState } from "react";

/** Leser ?søk= fra URL ved mount (f.eks. fra global søk). */
export function useModulSøkFraUrl(): [string, (v: string) => void] {
  const [søk, setSøk] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("søk") ?? params.get("q") ?? "";
    if (q) setSøk(q);
  }, []);

  return [søk, setSøk];
}
