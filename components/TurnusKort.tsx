"use client";

import type { Turnus } from "@/lib/domain";
import { aktivTurnusUke } from "@/lib/utils/turnusUtils";

const DAG_NAVN: Record<string, string> = {
  "1": "Man", "2": "Tir", "3": "Ons", "4": "Tor",
  "5": "Fre", "6": "Lør", "7": "Søn",
};

const ALLE_DAGER = ["1", "2", "3", "4", "5", "6", "7"] as const;

type Props = {
  turnus: Turnus;
  visUke: 1 | 2;
  dagsDato?: string;
};

export default function TurnusKort({ turnus, visUke, dagsDato }: Props) {
  const aktivUke = dagsDato ? aktivTurnusUke(turnus, dagsDato) : null;
  const uke = visUke === 1 ? turnus.uke1 : (turnus.uke2 ?? turnus.uke1);

  if (!uke) {
    return (
      <div style={{ color: "var(--color-text-secondary)", fontSize: 13, padding: "8px 0" }}>
        Ingen rotasjon for uke {visUke}.
      </div>
    );
  }

  const erAktivUke = aktivUke === uke;
  const erDag = uke.skift === "Dag";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0" }}>

      {/* Skift-badge + aktiv-indikator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          display: "inline-block",
          padding: "3px 10px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          background: erDag ? "#E6F1FB" : "#EEEDFE",
          color: erDag ? "#185FA5" : "#534AB7",
        }}>
          {uke.skift}skift
        </span>
        {erAktivUke && (
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)", fontStyle: "italic" }}>
            Nåværende uke
          </span>
        )}
      </div>

      {/* Dagvisning */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {ALLE_DAGER.map((dagNr) => {
          const dagInfo = uke.dager[dagNr];
          const harArbeid = !!dagInfo;

          return (
            <div key={dagNr} style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "8px 4px",
              borderRadius: 8,
              background: harArbeid
                ? erDag ? "#F0F7FF" : "#F3F2FF"
                : "var(--color-background-secondary)",
            }}>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: harArbeid ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                letterSpacing: "0.02em",
              }}>
                {DAG_NAVN[dagNr]}
              </span>
              {harArbeid ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: erDag ? "#185FA5" : "#534AB7",
                  }}>
                    {dagInfo.startTid}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>–</span>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--color-text-secondary)",
                  }}>
                    {dagInfo.sluttTid}
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>fri</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Kommentar */}
      {turnus.kommentar && (
        <div style={{
          fontSize: 12,
          color: "var(--color-text-secondary)",
          fontStyle: "italic",
          padding: "4px 0",
        }}>
          ⚠️ {turnus.kommentar}
        </div>
      )}
    </div>
  );
}
