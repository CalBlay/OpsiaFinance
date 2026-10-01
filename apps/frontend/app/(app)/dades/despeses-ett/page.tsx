import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import { RouteLoading } from "@/components/ui/RouteLoading";
import { auth } from "@/lib/auth";
import { getAnysAmbAjustosEtt, llistaAjustosEtt } from "@/lib/despeses-ett/service";
import { esSuperOAdmin } from "@/lib/roles";
import { Suspense } from "react";
import { DespesesEttPanel } from "./DespesesEttPanel";

export const metadata = { title: "Despeses ETT — OpsiaFinance" };

const tab = getDadesTabById("despeses-ett");

async function Content({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string }>;
}) {
  const sp = await searchParams;
  const [session, anys] = await Promise.all([auth(), getAnysAmbAjustosEtt()]);

  const anyFiltre = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const mesFiltre = sp.mes ? Number(sp.mes) : null;
  const role = session?.user?.role;
  const canEdit = esSuperOAdmin(role) || role === "EDICIO";

  const resums = await llistaAjustosEtt({
    any: Number.isFinite(anyFiltre) ? anyFiltre : null,
    mes: mesFiltre && mesFiltre >= 1 && mesFiltre <= 12 ? mesFiltre : null,
  });

  return (
    <DadesPageShell title={tab.title} description={tab.description}>
      <DespesesEttPanel
        resums={resums}
        anys={anys.length ? anys : [anyFiltre]}
        filtreAny={anyFiltre}
        filtreMes={mesFiltre}
        canEdit={canEdit}
      />
    </DadesPageShell>
  );
}

export default function DespesesEttPage({
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
