"use client";

import { useState } from "react";
import ModalPortal from "@/components/ModalPortal";
import type { Turnus, TurnusUke, TurnusUkedag } from "@/lib/domain";

const DAG_NAVN: Record<string, string> = {
  "1": "Mandag", "2": "Tirsdag", "3": "Onsdag", "4": "Torsdag",
  "5": "Fredag", "6": "Lørdag", "7": "Søndag",
};

const ALLE_DAGER = ["1", "2", "3", "4", "5", "6", "7"] as const;

type DagRad = {
  dagNr: string;
  aktiv: boolean;
  startTid: string;
  sluttTid: string;
};

function ukeTilRader(uke: TurnusUke | undefined): DagRad[] {
  return ALLE_DAGER.map((dagNr) => {
    const info = uke?.dager[dagNr];
    return {
      dagNr,
      aktiv: !!info,
      startTid: info?.startTid ?? "06:00",
      sluttTid: info?.sluttTid ?? "14:00",
    };
  });
}

function raderTilUke(rader: DagRad[], skift: "Dag" | "Kveld"): TurnusUke {
  const dager: Partial<Record<string, TurnusUkedag>> = {};
  for (const rad of rader) {
    if (rad.aktiv) {
      dager[rad.dagNr] = { startTid: rad.startTid, sluttTid: rad.sluttTid };
    }
  }
  return { skift, dager };
}

type Props = {
  ansattNavn: string;
  turnus?: Turnus;
  onLagre: (turnus: Turnus) => void;
  onLukk: () => void;
};

export default function TurnusEditor({ ansattNavn, turnus, onLagre, onLukk }: Props) {
  const harRotasjon = !!turnus?.uke2;

  const [visUke, setVisUke] = useState<1 | 2>(1);
  const [medRotasjon, setMedRotasjon] = useState(harRotasjon);
  const [skift1, setSkift1] = useState<"Dag" | "Kveld">(turnus?.uke1?.skift ?? "Dag");
  const [skift2, setSkift2] = useState<"Dag" | "Kveld">(turnus?.uke2?.skift ?? "Kveld");
  const [rader1, setRader1] = useState<DagRad[]>(() => ukeTilRader(turnus?.uke1));
  const [rader2, setRader2] = useState<DagRad[]>(() => ukeTilRader(turnus?.uke2));

  const aktivRader = visUke === 1 ? rader1 : rader2;
  const setAktivRader = visUke === 1 ? setRader1 : setRader2;
  const aktivSkift = visUke === 1 ? skift1 : skift2;
  const setAktivSkift = visUke === 1 ? setSkift1 : setSkift2;

  function oppdaterRad(dagNr: string, felt: Partial<DagRad>) {
    setAktivRader((prev) =>
      prev.map((r) => (r.dagNr === dagNr ? { ...r, ...felt } : r)),
    );
  }

  function lagre() {
    const nyTurnus: Turnus = {
      referanseDato: turnus?.referanseDato ?? "2026-06-16",
      aktivUkeVedReferanse: turnus?.aktivUkeVedReferanse ?? 2,
      uke1: raderTilUke(rader1, skift1),
      uke2: medRotasjon ? raderTilUke(rader2, skift2) : undefined,
      kommentar: turnus?.kommentar,
    };
    onLagre(nyTurnus);
  }

  const erDag = aktivSkift === "Dag";

  return (
    <ModalPortal>
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: "var(--z-dialog)",
      padding: 16,
    }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onLukk(); }}
    >
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)",
        borderRadius: 12, padding: 24, width: 560, maxWidth: "95vw",
        maxHeight: "90vh", overflowY: "auto",
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        {/* Header */}
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
              background: "none", border: "none", cursor: "pointer",
              fontSize: 20, color: "var(--foreground-muted)", padding: "4px 8px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Rotasjon-toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="checkbox"
            id="med-rotasjon"
            checked={medRotasjon}
            onChange={(e) => {
              setMedRotasjon(e.target.checked);
              if (e.target.checked) setVisUke(1);
            }}
          />
          <label htmlFor="med-rotasjon" style={{ fontSize: 13, color: "var(--foreground)", cursor: "pointer" }}>
            2-ukers rotasjon (tidlig/sent annenhver uke)
          </label>
        </div>

        {/* Uke-tabs */}
        {medRotasjon && (
          <div style={{ display: "flex", gap: 6 }}>
            {([1, 2] as const).map((uke) => (
              <button
                key={uke}
                type="button"
                onClick={() => setVisUke(uke)}
                style={{
                  padding: "5px 14px", borderRadius: 6, fontSize: 13, fontWeight: 500,
                  cursor: "pointer", border: "1px solid var(--border)",
                  background: visUke === uke ? "var(--brand-primary)" : "var(--background-subtle)",
                  color: visUke === uke ? "#fff" : "var(--foreground)",
                }}
              >
                Uke {uke}
              </button>
            ))}
          </div>
        )}

        {/* Skift-velger */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--foreground-muted)" }}>Skift:</span>
          {(["Dag", "Kveld"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setAktivSkift(s)}
              style={{
                padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                cursor: "pointer", border: "none",
                background: aktivSkift === s
                  ? (s === "Dag" ? "#E6F1FB" : "#EEEDFE")
                  : "var(--background-subtle)",
                color: aktivSkift === s
                  ? (s === "Dag" ? "#185FA5" : "#534AB7")
                  : "var(--foreground-muted)",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Dagene */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {aktivRader.map((rad) => (
            <div key={rad.dagNr} style={{
              display: "grid", gridTemplateColumns: "100px 32px 1fr 1fr",
              alignItems: "center", gap: 10,
              padding: "8px 12px", borderRadius: 8,
              background: rad.aktiv
                ? erDag ? "#F0F7FF" : "#F3F2FF"
                : "var(--background-subtle)",
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>
                {DAG_NAVN[rad.dagNr]}
              </span>
              <input
                type="checkbox"
                checked={rad.aktiv}
                onChange={(e) => oppdaterRad(rad.dagNr, { aktiv: e.target.checked })}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <label style={{ fontSize: 11, color: "var(--foreground-muted)" }}>Start</label>
                <input
                  type="time"
                  value={rad.startTid}
                  disabled={!rad.aktiv}
                  onChange={(e) => oppdaterRad(rad.dagNr, { startTid: e.target.value })}
                  style={{
                    fontSize: 13, padding: "4px 6px", borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--foreground)",
                    opacity: rad.aktiv ? 1 : 0.4,
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <label style={{ fontSize: 11, color: "var(--foreground-muted)" }}>Slutt</label>
                <input
                  type="time"
                  value={rad.sluttTid}
                  disabled={!rad.aktiv}
                  onChange={(e) => oppdaterRad(rad.dagNr, { sluttTid: e.target.value })}
                  style={{
                    fontSize: 13, padding: "4px 6px", borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--foreground)",
                    opacity: rad.aktiv ? 1 : 0.4,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: "var(--foreground-muted)", margin: 0, lineHeight: 1.45 }}>
          Lørdag: sett arbeidstid for arbeidshelg. Hvilke lørdager som faktisk gjelder
          defineres i masterplan (4-ukers rullering).
        </p>

        {/* Handlinger */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8 }}>
          <button
            type="button"
            onClick={onLukk}
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 13,
              cursor: "pointer", border: "1px solid var(--border)",
              background: "var(--background-subtle)",
              color: "var(--foreground)",
            }}
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={lagre}
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: "pointer", border: "none",
              background: "var(--brand-primary)", color: "#fff",
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
