import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import { RouteLoading } from "@/components/ui/RouteLoading";
import { auth } from "@/lib/auth";
import { getRepartimentPeriodsLlista } from "@/lib/dades-list";
import { periodesToExportInforme } from "@/lib/export/dades";
import { Suspense } from "react";
import { RepartimentLlista } from "./RepartimentLlista";

export const metadata = { title: "Repartiment mensual — OpsiaFinance" };

const tab = getDadesTabById("repartiment");

async function RepartimentContent() {
  const [session, items] = await Promise.all([auth(), getRepartimentPeriodsLlista()]);

  const role = session?.user?.role;
  const canEdit = role === "ADMIN" || role === "EDICIO";

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
      <RepartimentLlista periods={items} canEdit={canEdit} />
    </DadesPageShell>
  );
}

export default function RepartimentLlistaPage() {
  return (
    <Suspense fallback={<RouteLoading label="Carregant repartiment…" />}>
      <RepartimentContent />
    </Suspense>
  );
}
