"use client";

import { runMigrations } from "@/lib/maintenance/runMigrations";
import { AnsattStoreProvider } from "@/lib/state/ansattStore";
import { BilStoreProvider } from "@/lib/state/bilStore";
import { BilUtilgjengeligStoreProvider } from "@/lib/state/bilUtilgjengeligStore";
import { DagEndringStoreProvider } from "@/lib/state/dagEndringStore";

import { HengerStoreProvider } from "@/lib/state/hengerStore";
import { HengerUtilgjengeligStoreProvider } from "@/lib/state/hengerUtilgjengeligStore";
import { MasterplanStoreProvider } from "@/lib/state/masterplanStore";
import { PlanRuteTildelingStoreProvider } from "@/lib/state/planRuteTildelingStore";

import { Turnus4UkerStoreProvider } from "@/lib/state/turnus4ukerStore";
import { FraværStoreProvider } from "@/lib/state/fravaerStore";

export default function Providers({ children }: { children: React.ReactNode }) {
  if (typeof window !== "undefined") {
    runMigrations();
  }

  return (
    <AnsattStoreProvider>
      <BilStoreProvider>
        <HengerStoreProvider>
          <BilUtilgjengeligStoreProvider>
            <HengerUtilgjengeligStoreProvider>
              <MasterplanStoreProvider>
                <DagEndringStoreProvider>
                  <PlanRuteTildelingStoreProvider>
                    <Turnus4UkerStoreProvider>
                      <FraværStoreProvider>
                        {children}
                      </FraværStoreProvider>
                    </Turnus4UkerStoreProvider>
                  </PlanRuteTildelingStoreProvider>
                </DagEndringStoreProvider>
              </MasterplanStoreProvider>
            </HengerUtilgjengeligStoreProvider>
          </BilUtilgjengeligStoreProvider>
        </HengerStoreProvider>
      </BilStoreProvider>
    </AnsattStoreProvider>
  );
}
