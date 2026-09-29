import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import { RouteLoading } from "@/components/ui/RouteLoading";
import { auth } from "@/lib/auth";
import { getCarreguesFitxerLlista } from "@/lib/dades-list";
import { esSuperOAdmin } from "@/lib/roles";
import { getAnysAmbPlantillaRrhh, llistaPlantillaRrhh } from "@/lib/rrhh-plantilla/service-import";
import { Suspense } from "react";
import { PlantillaRrhhPanel } from "./PlantillaRrhhPanel";

export const metadata = { title: "Plantilla RRHH — OpsiaFinance" };

const tab = getDadesTabById("plantilla-rrhh");

async function Content({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string }>;
}) {
  const sp = await searchParams;
  const [session, anys, carregues] = await Promise.all([
    auth(),
    getAnysAmbPlantillaRrhh(),
    getCarreguesFitxerLlista("PLANTILLA_RRHH"),
  ]);

  const anyFiltre = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const mesFiltre = sp.mes ? Number(sp.mes) : null;
  const role = session?.user?.role;
  const canEdit = esSuperOAdmin(role) || role === "EDICIO";

  const registres = await llistaPlantillaRrhh(
    Number.isFinite(anyFiltre) ? anyFiltre : null,
    mesFiltre && mesFiltre >= 1 && mesFiltre <= 12 ? mesFiltre : null
  );

  return (
    <DadesPageShell title={tab.title} description={tab.description}>
      <PlantillaRrhhPanel
        registres={registres}
        carregues={carregues}
        anys={anys.length ? anys : [anyFiltre]}
        filtreAny={anyFiltre}
        filtreMes={mesFiltre}
        canEdit={canEdit}
      />
    </DadesPageShell>
  );
}

export default function PlantillaRrhhDadesPage({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string }>;
}) {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
