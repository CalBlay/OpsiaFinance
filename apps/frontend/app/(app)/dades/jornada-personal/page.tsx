import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import { RouteLoading } from "@/components/ui/RouteLoading";
import { auth } from "@/lib/auth";
import { getCarreguesFitxerLlista } from "@/lib/dades-list";
import { getAnysAmbJornadaPersonal, llistaJornadaPersonal } from "@/lib/jornada-personal/service";
import { esSuperOAdmin } from "@/lib/roles";
import { Suspense } from "react";
import { JornadaPersonalPanel } from "./JornadaPersonalPanel";

export const metadata = { title: "Jornada personal — OpsiaFinance" };

const tab = getDadesTabById("jornada-personal");

async function Content({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string }>;
}) {
  const sp = await searchParams;
  const [session, anys, carregues] = await Promise.all([
    auth(),
    getAnysAmbJornadaPersonal(),
    getCarreguesFitxerLlista("PLANTILLA_JORNADA"),
  ]);

  const anyFiltre = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const mesFiltre = sp.mes ? Number(sp.mes) : null;
  const role = session?.user?.role;
  const canEdit = esSuperOAdmin(role) || role === "EDICIO";

  const registres = await llistaJornadaPersonal(
    Number.isFinite(anyFiltre) ? anyFiltre : null,
    mesFiltre && mesFiltre >= 1 && mesFiltre <= 12 ? mesFiltre : null
  );

  return (
    <DadesPageShell title={tab.title} description={tab.description}>
      <JornadaPersonalPanel
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

export default function JornadaPersonalPage({
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
