"use client";

import { useCallback, useMemo } from "react";
import type { Ansatt, Bil, Henger } from "@/lib/domain";
import type { KjoretoySøkMedAnsatte } from "@/components/SokbarVelger";

export function useKjoretoySøkBil(
  ansatte: Ansatt[],
  biler: Bil[],
  ekstraSjåførPerKjoretoy?: ReadonlyMap<string, string> | Record<string, string>,
): KjoretoySøkMedAnsatte {
  const bilById = useMemo(() => new Map(biler.map((b) => [b.id, b] as const)), [biler]);
  const fastIdFraAnsatt = useCallback((a: Ansatt) => a.fastBilId, []);
  const etikettForId = useCallback(
    (id: string) => bilById.get(id)?.kjennemerke,
    [bilById],
  );
  return useMemo(
    () => ({
      ansatte,
      fastIdFraAnsatt,
      ekstraSjåførPerKjoretoy,
      etikettForId,
    }),
    [ansatte, fastIdFraAnsatt, ekstraSjåførPerKjoretoy, etikettForId],
  );
}

export function useKjoretoySøkHenger(
  ansatte: Ansatt[],
  hengere: Henger[],
  ekstraSjåførPerKjoretoy?: ReadonlyMap<string, string> | Record<string, string>,
): KjoretoySøkMedAnsatte {
  const hengerById = useMemo(
    () => new Map(hengere.map((h) => [h.id, h] as const)),
    [hengere],
  );
  const fastIdFraAnsatt = useCallback((a: Ansatt) => a.fastHengerId, []);
  const etikettForId = useCallback(
    (id: string) => hengerById.get(id)?.kjennemerke,
    [hengerById],
  );
  return useMemo(
    () => ({
      ansatte,
      fastIdFraAnsatt,
      ekstraSjåførPerKjoretoy,
      etikettForId,
    }),
    [ansatte, fastIdFraAnsatt, ekstraSjåførPerKjoretoy, etikettForId],
  );
}
