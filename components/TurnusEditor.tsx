"use client";

import { useState } from "react";
import ModalPortal from "@/components/ModalPortal";
import TurnusSkjema from "@/components/TurnusSkjema";
import type { Turnus } from "@/lib/domain";

type Props = {
  ansattNavn: string;
  turnus?: Turnus;
  onLagre: (turnus: Turnus) => void;
  onLukk: () => void;
};

export default function TurnusEditor({ ansattNavn, turnus, onLagre, onLukk }: Props) {
  const [utkast, setUtkast] = useState<Turnus>(
    () =>
      turnus ?? {
        referanseDato: "2026-06-16",
        aktivUkeVedReferanse: 2,
        uke1: { skift: "Dag", dager: { "1": { startTid: "06:00", sluttTid: "14:00" } } },
      },
  );

  return (
    <ModalPortal>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: "var(--z-dialog)",
          padding: 16,
        }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onLukk();
        }}
      >
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-lg)",
            borderRadius: 12,
            padding: 24,
            width: 560,
            maxWidth: "95vw",
            maxHeight: "90vh",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)" }}>
                Rediger turnus
              </div>
              <div style={{ fontSize: 13, color: "var(--foreground-muted)", marginTop: 2 }}>
                {ansattNavn}
              </div>
            </div>
            <button
              type="button"
              onClick={onLukk}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 20,
                color: "var(--foreground-muted)",
                padding: "4px 8px",
              }}
            >
              ✕
            </button>
          </div>

          <TurnusSkjema value={utkast} onChange={setUtkast} />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8 }}>
            <button
              type="button"
              onClick={onLukk}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 13,
                cursor: "pointer",
                border: "1px solid var(--border)",
                background: "var(--background-subtle)",
                color: "var(--foreground)",
              }}
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={() => onLagre(utkast)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: "var(--brand-primary)",
                color: "#fff",
              }}
            >
              Lagre turnus
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
