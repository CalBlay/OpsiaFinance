import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import { RouteLoading } from "@/components/ui/RouteLoading";
import { auth } from "@/lib/auth";
import {
  getAnysAmbVendesRestaurants,
  getCarreguesFitxerLlista,
  getDarrerMesVendesRestaurants,
  getVendesRestaurantsResums,
} from "@/lib/dades-list";
import { vendesResumsToExportInforme } from "@/lib/export/dades";
import { Suspense } from "react";
import { HistorialVendes } from "./HistorialVendes";
import { VendesRestaurantsManager } from "./VendesRestaurantsManager";

export const metadata = { title: "Vendes restaurants — OpsiaFinance" };

const tab = getDadesTabById("vendes-restaurants");

async function VendesRestaurantsContent({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string }>;
}) {
  const sp = await searchParams;
  const mesUrl = sp.mes ? Number(sp.mes) : null;

  const [session, anys, carregues] = await Promise.all([
    auth(),
    getAnysAmbVendesRestaurants(),
    getCarreguesFitxerLlista(["VENDES_V", "VENDES_DETALL", "VENDES_PACK"]),
  ]);

  const anyFiltre = sp.any ? Number(sp.any) : anys[0];
  const mesFiltre = mesUrl ?? (await getDarrerMesVendesRestaurants(anyFiltre));

  const resums = await getVendesRestaurantsResums(anyFiltre, mesFiltre);

  const role = session?.user?.role;
  const canEdit = role === "ADMIN" || role === "EDICIO";

  const meta = `${resums.length} període${resums.length !== 1 ? "s" : ""}/centre · ${anyFiltre}${
    mesFiltre ? `/${mesFiltre}` : ""
  }`;

  return (
    <DadesPageShell
      title={tab.title}
      description={
        <>
          {tab.description} {meta}.
        </>
      }
      actions={
        <ExportInformeButton
          informe={
            resums.length
              ? vendesResumsToExportInforme(resums, {
                  any: anyFiltre,
                  mes: mesFiltre,
                  title: tab.title,
                })
              : null
          }
        />
      }
    >
      <HistorialVendes items={carregues} canEdit={canEdit} />
      <VendesRestaurantsManager
        resums={resums}
        anys={anys}
        canEdit={canEdit}
        filtreAny={anyFiltre}
        filtreMes={mesFiltre}
      />
    </DadesPageShell>
  );
}

export default function VendesRestaurantsDadesPage({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string }>;
}) {
  return (
    <Suspense fallback={<RouteLoading label="Carregant vendes…" />}>
      <VendesRestaurantsContent searchParams={searchParams} />
    </Suspense>
  );
}
