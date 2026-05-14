import Link from "next/link";
import styles from "@/app/fravaer/page.module.css";

export default function KjoretoyUtilgjengeligHubPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Kjøretøy · utilgjengelighet</h1>
          <p className={styles.helper}>
            Samme idé som fravær for ansatte: registrer når en bil eller henger er ute av drift i en periode
            (planlagt eller akutt). Disse dataene kan brukes til å vite om kjøretøyet kan settes opp på en gitt
            dag.
          </p>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "1fr",
          maxWidth: "40rem",
        }}
      >
        <Link
          href="/biler/utilgjengelig"
          style={{
            display: "block",
            padding: "1.25rem 1.5rem",
            borderRadius: "0.75rem",
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            boxShadow: "0 1px 2px rgb(15 23 42 / 6%)",
            textDecoration: "none",
            color: "#0f172a",
            fontWeight: 800,
            fontSize: "1.1rem",
          }}
        >
          Biler — utilgjengelighetsperioder
          <div style={{ marginTop: "0.35rem", fontWeight: 500, fontSize: "0.95rem", color: "#64748b" }}>
            Vedlikehold, havari, service …
          </div>
        </Link>
        <Link
          href="/henger/utilgjengelig"
          style={{
            display: "block",
            padding: "1.25rem 1.5rem",
            borderRadius: "0.75rem",
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            boxShadow: "0 1px 2px rgb(15 23 42 / 6%)",
            textDecoration: "none",
            color: "#0f172a",
            fontWeight: 800,
            fontSize: "1.1rem",
          }}
        >
          Henger — utilgjengelighetsperioder
          <div style={{ marginTop: "0.35rem", fontWeight: 500, fontSize: "0.95rem", color: "#64748b" }}>
            Samme registrering for tilhenger
          </div>
        </Link>
      </div>
    </div>
  );
}
