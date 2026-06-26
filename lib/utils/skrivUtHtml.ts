/** Skriv ut frittstående HTML uten popup — bruker skjult iframe. */
export function skrivUtHtml(html: string): void {
  if (typeof document === "undefined") return;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Utskrift");
  // Full størrelse utenfor skjerm — 1px iframe gir feil tabellayout ved utskrift.
  iframe.style.cssText =
    "position:fixed;left:0;top:0;width:100%;height:100%;border:none;opacity:0;pointer-events:none;z-index:-1;";

  let startet = false;

  const ryddOpp = () => {
    if (iframe.isConnected) iframe.remove();
  };

  const startUtskrift = () => {
    if (startet) return;
    startet = true;

    const win = iframe.contentWindow;
    if (!win) {
      ryddOpp();
      window.alert("Kunne ikke starte utskrift.");
      return;
    }

    win.addEventListener("afterprint", ryddOpp, { once: true });
    window.setTimeout(ryddOpp, 60_000);

    try {
      win.focus();
      win.print();
    } catch {
      ryddOpp();
      window.alert("Kunne ikke starte utskrift.");
    }
  };

  iframe.onload = () => {
    requestAnimationFrame(() => requestAnimationFrame(startUtskrift));
  };

  document.body.appendChild(iframe);
  iframe.srcdoc = html;

  // Fallback hvis onload ikke fyres
  window.setTimeout(startUtskrift, 2000);
}
