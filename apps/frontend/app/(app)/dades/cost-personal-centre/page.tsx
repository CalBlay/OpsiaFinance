import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import { auth } from "@/lib/auth";
import { llistaCarreguesFitxer } from "@/lib/carrega-fitxer";
import { db } from "@/lib/db";
import { CostPersonalCentrePanel } from "./CostPersonalCentrePanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cost personal centre — OpsiaFinance" };

const tab = getDadesTabById("cost-personal-centre");

export default async function CostPersonalCentreDadesPage({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string }>;
}) {
  const sp = await searchParams;
  const mesFiltre = sp.mes ? Number(sp.mes) : null;

  const [session, anysRaw, carregues] = await Promise.all([
    auth(),
    db.period.findMany({
      where: { costsPersonalsCentre: { some: {} } },
      select: { any: true },
      distinct: ["any"],
      orderBy: { any: "desc" },
    }),
    llistaCarreguesFitxer("COST_PERSONAL_CENTRE"),
  ]);

  const anys = anysRaw.map((a) => a.any);
  if (!anys.length) anys.push(new Date().getFullYear());
  const anyFiltre = sp.any ? Number(sp.any) : anys[0];

  const registres = await db.costPersonalCentre.findMany({
    where: {
      period: {
        any: anyFiltre,
        ...(mesFiltre ? { mes: mesFiltre } : {}),
      },
    },
    orderBy: [
      { period: { mes: "desc" } },
      { centre: { codi: "asc" } },
      { departamentSalarial: "asc" },
    ],
    select: {
      id: true,
      importBrut: true,
      segSocialEmpresa: true,
      totalSegSocial: true,
      costPersonal: true,
      textOrigen: true,
      departamentSalarial: true,
      period: { select: { nom: true } },
      centre: { select: { codi: true, nom: true } },
    },
    take: 800,
  });

  const role = session?.user?.role;
  const canEdit = role === "ADMIN" || role === "EDICIO";

  return (
    <DadesPageShell title={tab.title} description={tab.description}>
      <CostPersonalCentrePanel
        canEdit={canEdit}
        anys={anys}
        filtreAny={anyFiltre}
        filtreMes={mesFiltre}
        carregues={carregues}
        registres={registres.map((r) => ({
          id: r.id,
          centreLabel: `${r.centre.codi} · ${r.centre.nom}`,
          dept:
            r.departamentSalarial === "CUINA"
              ? "Cuina"
              : r.departamentSalarial === "SALA"
                ? "Sala"
                : "",
          importBrut: Number(r.importBrut),
          provisioPaguesExtres: Number(r.segSocialEmpresa),
          totalSegSocial: Math.max(
            0,
            Number(r.costPersonal) - Number(r.importBrut) - Number(r.segSocialEmpresa)
          ),
          costPersonal: Number(r.costPersonal),
          textOrigen: r.textOrigen,
          periodNom: r.period.nom,
        }))}
      />
    </DadesPageShell>
  );
}
