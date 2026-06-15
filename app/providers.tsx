"use client";

import BilTilbakeVarsler from "@/components/BilTilbakeVarsler";
import DataReadyGate from "@/components/DataReadyGate";
import ToastViewport from "@/components/ToastViewport";
import { runMigrations } from "@/lib/maintenance/runMigrations";
import { AnsattStoreProvider } from "@/lib/state/ansattStore";
import { BilStoreProvider } from "@/lib/state/bilStore";
import { BilUtilgjengeligStoreProvider } from "@/lib/state/bilUtilgjengeligStore";
import { ToastStoreProvider } from "@/lib/state/toastStore";
import { DagEndringStoreProvider } from "@/lib/state/dagEndringStore";
import { SkiftTilgjengelighetStoreProvider } from "@/lib/state/skiftTilgjengelighetStore";
import { HentingStoreProvider } from "@/lib/state/hentingStore";

import { HengerStoreProvider } from "@/lib/state/hengerStore";
import { HengerUtilgjengeligStoreProvider } from "@/lib/state/hengerUtilgjengeligStore";
import { MasterplanStoreProvider } from "@/lib/state/masterplanStore";
import { PlanRuteTildelingStoreProvider } from "@/lib/state/planRuteTildelingStore";

import { Turnus4UkerStoreProvider } from "@/lib/state/turnus4ukerStore";
import { FraværStoreProvider } from "@/lib/state/fravaerStore";
import { BemanningsplanStoreProvider } from "@/lib/state/bemanningsplanStore";
import { AuthStoreProvider } from "@/lib/state/authStore";
import { AppDataReloadProvider } from "@/lib/state/appDataReload";
import { SkySaveStoreProvider } from "@/lib/state/skySaveStore";

let migrationsKjørt = false;

export default function Providers({ children }: { children: React.ReactNode }) {
  if (typeof window !== "undefined" && !migrationsKjørt) {
    migrationsKjørt = true;
    runMigrations();
  }

  return (
    <AuthStoreProvider>
      <AppDataReloadProvider>
      <SkySaveStoreProvider>
      <ToastStoreProvider>
      <AnsattStoreProvider>
        <BilStoreProvider>
          <HengerStoreProvider>
            <BilUtilgjengeligStoreProvider>
              <HengerUtilgjengeligStoreProvider>
                <MasterplanStoreProvider>
                  <DagEndringStoreProvider>
                    <SkiftTilgjengelighetStoreProvider>
                    <HentingStoreProvider>
                    <PlanRuteTildelingStoreProvider>
                      <Turnus4UkerStoreProvider>
                        <BemanningsplanStoreProvider>
                        <FraværStoreProvider>
                          <DataReadyGate>
                            <BilTilbakeVarsler />
                            {children}
                            <ToastViewport />
                          </DataReadyGate>
                        </FraværStoreProvider>
                        </BemanningsplanStoreProvider>
                      </Turnus4UkerStoreProvider>
                    </PlanRuteTildelingStoreProvider>
                    </HentingStoreProvider>
                    </SkiftTilgjengelighetStoreProvider>
                  </DagEndringStoreProvider>
                </MasterplanStoreProvider>
              </HengerUtilgjengeligStoreProvider>
            </BilUtilgjengeligStoreProvider>
          </HengerStoreProvider>
        </BilStoreProvider>
      </AnsattStoreProvider>
      </ToastStoreProvider>
      </SkySaveStoreProvider>
      </AppDataReloadProvider>
    </AuthStoreProvider>
  );
}
