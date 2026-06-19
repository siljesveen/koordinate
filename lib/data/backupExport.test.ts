import { describe, expect, it } from "vitest";
import {
  backupDownloadFilename,
  exportAppDataFromLocalStorage,
  parseBackupFile,
  tellBackupPoster,
} from "./backupExport";

describe("exportAppDataFromLocalStorage", () => {
  it("samler kun kjente nøkler med gyldig JSON", () => {
    const store = new Map<string, string>([
      ["bemanning.ansatte.v2", JSON.stringify([{ id: "a1" }])],
      ["bemanning.biler.v1", JSON.stringify([])],
      ["ukjent.nøkkel", JSON.stringify({ x: 1 })],
    ]);

    const backup = exportAppDataFromLocalStorage((key) => store.get(key) ?? null);

    expect(backup.meta.app).toBe("koordinate");
    expect(backup.meta.version).toBe(1);
    expect(backup.data["bemanning.ansatte.v2"]).toEqual([{ id: "a1" }]);
    expect(backup.data["bemanning.biler.v1"]).toEqual([]);
    expect(backup.data["ukjent.nøkkel"]).toBeUndefined();
  });
});

describe("parseBackupFile", () => {
  it("leser ny konvolutt-format", () => {
    const result = parseBackupFile({
      meta: { version: 1, exportedAt: "2026-06-18T00:00:00.000Z", app: "koordinate" },
      data: {
        "bemanning.fravaer.v1": [{ id: "f1" }],
      },
    });

    expect(result?.format).toBe("envelope");
    expect(result?.keys).toEqual(["bemanning.fravaer.v1"]);
    expect(result?.data["bemanning.fravaer.v1"]).toEqual([{ id: "f1" }]);
  });

  it("leser eldre flate backup-filer", () => {
    const result = parseBackupFile({
      "bemanning.masterplan.v1": { slots: [] },
      "random.key": 123,
    });

    expect(result?.format).toBe("legacy");
    expect(result?.keys).toEqual(["bemanning.masterplan.v1"]);
  });

  it("avviser filer uten kjente nøkler", () => {
    expect(parseBackupFile({ foo: "bar" })).toBeNull();
    expect(parseBackupFile(null)).toBeNull();
    expect(parseBackupFile([])).toBeNull();
  });

  it("avviser konvolutt fra annen app", () => {
    expect(
      parseBackupFile({
        meta: { app: "annen-app" },
        data: { "bemanning.biler.v1": [] },
      }),
    ).toBeNull();
  });
});

describe("tellBackupPoster", () => {
  it("teller array-lengder og objekter", () => {
    expect(
      tellBackupPoster({
        "bemanning.biler.v1": [{ id: "1" }, { id: "2" }],
        "bemanning.plan.v1": { drivers: {} },
      }),
    ).toEqual({ nøkler: 2, poster: 3 });
  });
});

describe("backupDownloadFilename", () => {
  it("bruker ISO-dato uten klokkeslett", () => {
    expect(backupDownloadFilename(new Date("2026-06-18T14:30:00Z"))).toBe(
      "koordinate-backup-2026-06-18.json",
    );
  });
});
