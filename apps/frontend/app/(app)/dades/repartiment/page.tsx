import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import { db } from "@/lib/db";
import { periodesToExportInforme } from "@/lib/export/dades";
import { RepartimentLlista } from "./RepartimentLlista";

export const dynamic = "force-dynamic";
export const metadata = { title: "Repartiment mensual — OpsiaFinance" };

const tab = getDadesTabById("repartiment");

export default async function RepartimentLlistaPage() {
  const periods = await db.period.findMany({
    where: { dadesResultat: { some: {} } },
    orderBy: [{ any: "desc" }, { mes: "desc" }],
    include: { execucioRepartiment: { select: { id: true, estat: true } } },
  });

  const items = periods.map((p) => ({
    id: p.id,
    nom: p.nom,
    any: p.any,
    mes: p.mes,
    estat: (p.execucioRepartiment?.estat as "CONFIRMAT" | "BORRADOR" | null) ?? null,
  }));

  return (
    <DadesPageShell
      title={tab.title}
      description={tab.description}
      actions={
        <ExportInformeButton
          informe={
            items.length
              ? periodesToExportInforme(items, {
                  title: tab.title,
                  filename: "dades-repartiment",
                })
              : null
          }
        />
      }
    >
      <RepartimentLlista periods={items} />
    </DadesPageShell>
  );
}
