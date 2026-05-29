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

import { HengerStoreProvider } from "@/lib/state/hengerStore";
import { HengerUtilgjengeligStoreProvider } from "@/lib/state/hengerUtilgjengeligStore";
import { MasterplanStoreProvider } from "@/lib/state/masterplanStore";
import { PlanRuteTildelingStoreProvider } from "@/lib/state/planRuteTildelingStore";

import { Turnus4UkerStoreProvider } from "@/lib/state/turnus4ukerStore";
import { FraværStoreProvider } from "@/lib/state/fravaerStore";
import { AuthStoreProvider } from "@/lib/state/authStore";
import { AppDataReloadProvider } from "@/lib/state/appDataReload";
import { SkySaveStoreProvider } from "@/lib/state/skySaveStore";

export default function Providers({ children }: { children: React.ReactNode }) {
  if (typeof window !== "undefined") {
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
                    <PlanRuteTildelingStoreProvider>
                      <Turnus4UkerStoreProvider>
                        <FraværStoreProvider>
                          <DataReadyGate>
                            <BilTilbakeVarsler />
                            {children}
                            <ToastViewport />
                          </DataReadyGate>
                        </FraværStoreProvider>
                      </Turnus4UkerStoreProvider>
                    </PlanRuteTildelingStoreProvider>
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
