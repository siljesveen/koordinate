# Regler for AI-hjelp i KOordinate

Dette dokumentet beskriver spillreglene Cursor bruker når du koder i dette prosjektet.  
Reglene ligger også som filer i **`.cursor/rules/`** (disse leses automatisk av Cursor).

## Hvor finner du reglene?

| Sted | Hva |
|------|-----|
| `.cursor/rules/*.mdc` | Prosjektregler (følger med i mappen) |
| Cursor → Settings → Rules | Dine personlige regler på tvers av alle prosjekter |

Du trenger normalt **ikke** åpne `.mdc`-filene — Cursor bruker dem i bakgrunnen.

## Regelfiler i dette prosjektet

| Fil | Innhold |
|-----|---------|
| `koordinate-prosjekt.mdc` | Norsk svar, mappestruktur, ikke commit uten beskjed |
| **`kun-en-endring.mdc`** | **Kun én endring om gangen** — unngår at noe annet «plutselig» endres |
| `koordinate-data.mdc` | Supabase, masterplan, koblinger, backup |
| `react-ui.mdc` | React/UI-mønstre når du redigerer `.tsx`/`.ts` |

## Viktigst: én endring om gangen

Dette er lagt inn fordi **koblingsgrupper** forsvant da flere ting (innlogging + datalagring) ble endret samtidig.

**For deg betyr det:**

- Be om én ting av gangen, f.eks. «fiks innlogging» — ikke «fiks alt med Supabase».
- Si fra hvis du merker at noe **annet** enn det du ba om, har endret seg.
- Ta **backup** under Innstillinger før store endringer.

**For AI betyr det:**

- Minste mulige endring i koden.
- Ingen refaktorering «med på kjøpet».
- Data/lagring endres ikke med mindre du ber om det.
- Hvis flere steg trengs: **gjør steg 1**, skriv **«Neste steg»** (nummerert), og **spør** om du skal fortsette — ikke gjør alt uten beskjed.

## Endre reglene selv

1. Åpne mappen `bemanning-dashboard/.cursor/rules/`
2. Rediger en `.mdc`-fil i Cursor (vanlig tekst + YAML øverst)
3. Lagre — neste chat i prosjektet bruker oppdaterte regler

Eksempel på egen regel:

```markdown
---
description: Min regel
alwaysApply: true
---

- Alltid forklar hva du gjør i maks 3 korte steg.
```

## Backup (påminnelse)

- **Vercel** for daglig arbeid med ekte data
- **Innstillinger** → **Last ned backup** jevnlig
- Localhost-backup gjelder bare den nettleseren — ikke Vercel automatisk
