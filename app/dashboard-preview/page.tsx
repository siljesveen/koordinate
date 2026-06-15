import Link from "next/link";
import styles from "./page.module.css";

/** Statisk designmockup — erstatter forsiden når den er godkjent. */
export default function DashboardPreviewPage() {
  return (
    <div className={styles.page}>
      <div className={styles.banner}>
        Designmockup — dette er en forhåndsvisning av nytt dashbord. Dagens forsiden ligger fortsatt på{" "}
        <Link href="/">/</Link>.
      </div>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>I dag</h1>
          <p className={styles.subtitle}>Onsdag 27. mai 2026 · Syklus uke 2 · onsdag</p>
        </div>
        <Link href="/plan" className={styles.primaryBtn}>
          Åpne Plan for i dag
        </Link>
      </header>

      <div className={styles.cardGrid}>
        <div className={`${styles.card} ${styles.cardGreen}`}>
          <div className={styles.cardValue}>34</div>
          <div className={styles.cardLabel}>Ruter OK</div>
        </div>
        <div className={`${styles.card} ${styles.cardRed}`}>
          <div className={styles.cardValue}>5</div>
          <div className={styles.cardLabel}>Trenger handling</div>
        </div>
        <div className={`${styles.card} ${styles.cardYellow}`}>
          <div className={styles.cardValue}>12</div>
          <div className={styles.cardLabel}>Avspasert / fravær</div>
        </div>
        <div className={`${styles.card} ${styles.cardYellow}`}>
          <div className={styles.cardValue}>2</div>
          <div className={styles.cardLabel}>Kjøretøy ute</div>
        </div>
        <div className={`${styles.card} ${styles.cardBlue}`}>
          <div className={styles.cardValue}>6</div>
          <div className={styles.cardLabel}>Ledige sjåfører</div>
        </div>
      </div>

      <div className={styles.mainGrid}>
        <section>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Trenger handling</h2>
            <span className={styles.badge}>5 saker</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Rute</th>
                  <th>Rutenavn</th>
                  <th>Skift</th>
                  <th>Problem</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr className={styles.rowWarn}>
                  <td className={styles.rute}>1228-1</td>
                  <td className={styles.muted}>Løten-Stange</td>
                  <td>Dag</td>
                  <td className={styles.problem}>Mangler sjåfør</td>
                  <td>
                    <Link href="/plan" className={styles.actionLink}>
                      Fiks i Plan →
                    </Link>
                  </td>
                </tr>
                <tr className={styles.rowWarn}>
                  <td className={styles.rute}>4127-2</td>
                  <td className={styles.muted}>Hamar</td>
                  <td>Dag</td>
                  <td className={styles.problem}>Sjåfør avspaserer</td>
                  <td>
                    <Link href="/plan" className={styles.actionLink}>
                      Fiks i Plan →
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td className={styles.rute}>3228-1</td>
                  <td className={styles.muted}>Løten-Stange</td>
                  <td>Kveld</td>
                  <td className={styles.problem}>Bil utilgjengelig</td>
                  <td>
                    <Link href="/plan" className={styles.actionLink}>
                      Fiks i Plan →
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td className={styles.rute}>6151</td>
                  <td className={styles.muted}>Toten</td>
                  <td>Dag</td>
                  <td className={styles.problem}>Sjåfør på 2 ruter</td>
                  <td>
                    <Link href="/plan" className={styles.actionLink}>
                      Fiks i Plan →
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td className={styles.rute}>2228-1</td>
                  <td className={styles.muted}>Løten-Stange</td>
                  <td>Kveld</td>
                  <td className={styles.problem}>Mangler henger</td>
                  <td>
                    <Link href="/plan" className={styles.actionLink}>
                      Fiks i Plan →
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div className={styles.sideStack}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>Personer ute · 12</div>
            <div className={styles.panelRow}>
              <span className={styles.panelName}>Christian Elvestad</span>
              <span className={`${styles.tag} ${styles.tagWarn}`}>Avspasering</span>
              <span className={styles.planNote}>Christian 2s</span>
            </div>
            <div className={styles.panelRow}>
              <span className={styles.panelName}>Morten Steinbakken</span>
              <span className={`${styles.tag} ${styles.tagWarn}`}>Avspasering</span>
              <span className={styles.planNote}>Morten S</span>
            </div>
            <div className={styles.panelRow}>
              <span className={styles.panelName}>Erik Solbakken</span>
              <span className={`${styles.tag} ${styles.tagError}`}>Syk</span>
            </div>
            <div className={styles.panelRow}>
              <span className={styles.panelName}>Jack Petersen</span>
              <span className={`${styles.tag} ${styles.tagWarn}`}>Avspasering</span>
              <span className={styles.planNote}>Jack, 2 skift</span>
            </div>
            <div className={styles.panelRow}>
              <span className={styles.panelName}>Perti Portimo</span>
              <span className={`${styles.tag} ${styles.tagInfo}`}>Fri</span>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>Kjøretøy ute · 2</div>
            <div className={styles.panelRow}>
              <span className={styles.panelName}>RL 12345 · Bil</span>
              <span className={`${styles.tag} ${styles.tagWarn}`}>Verksted</span>
              <span className={styles.planNote}>27.05–29.05</span>
            </div>
            <div className={styles.panelRow}>
              <span className={styles.panelName}>RL 67890 · Henger</span>
              <span className={`${styles.tag} ${styles.tagError}`}>Skade</span>
              <span className={styles.planNote}>27.05–28.05</span>
            </div>
          </section>

          <Link href="/plan" className={styles.actionLink}>
            Se full dagsoversikt
          </Link>
        </div>
      </div>

      <div className={styles.shiftGrid}>
        <div className={styles.shiftCard}>
          <div className={styles.shiftHead}>
            <span>Dagskift</span>
            <span className={`${styles.tag} ${styles.tagInfo}`}>34 OK</span>
          </div>
          <div className={styles.shiftBody}>
            <div className={styles.shiftStats}>
              <div>
                <div className={styles.shiftStatLabel}>OK</div>
                <div className={styles.shiftStatValue}>34</div>
              </div>
              <div>
                <div className={styles.shiftStatLabel}>Problemer</div>
                <div className={`${styles.shiftStatValue} ${styles.shiftStatBad}`}>3</div>
              </div>
              <div>
                <div className={styles.shiftStatLabel}>Avspasering</div>
                <div className={styles.shiftStatValue}>8</div>
              </div>
            </div>
            <Link href="/plan" className={styles.shiftLink}>
              Åpne dagskift i Plan
            </Link>
          </div>
        </div>

        <div className={styles.shiftCard}>
          <div className={styles.shiftHead}>
            <span>Kveldsskift</span>
            <span className={`${styles.tag} ${styles.tagWarn}`}>2 problemer</span>
          </div>
          <div className={styles.shiftBody}>
            <div className={styles.shiftStats}>
              <div>
                <div className={styles.shiftStatLabel}>OK</div>
                <div className={styles.shiftStatValue}>6</div>
              </div>
              <div>
                <div className={styles.shiftStatLabel}>Problemer</div>
                <div className={`${styles.shiftStatValue} ${styles.shiftStatBad}`}>2</div>
              </div>
              <div>
                <div className={styles.shiftStatLabel}>Avspasering</div>
                <div className={styles.shiftStatValue}>4</div>
              </div>
            </div>
            <Link href="/plan" className={styles.shiftLink}>
              Åpne kveldsskift i Plan
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.tomorrow}>
        <div className={styles.tomorrowTitle}>I morgen · torsdag 28. mai · syklus uke 2 dag 4</div>
        <p className={styles.tomorrowText}>
          3 ruter trenger sjekk · 5 sjåfører har avspasering (bl.a. Morten Steinbakken, Perti Portimo)
        </p>
        <Link href="/plan" className={styles.tomorrowLink}>
          Forhåndsvis torsdag i Plan
        </Link>
      </div>
    </div>
  );
}
