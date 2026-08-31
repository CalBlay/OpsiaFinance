import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import { RouteLoading } from "@/components/ui/RouteLoading";
import { auth } from "@/lib/auth";
import { getTraspassPersonalPeriodsLlista } from "@/lib/dades-list";
import { periodesToExportInforme } from "@/lib/export/dades";
import Link from "next/link";
import { Suspense } from "react";
import { PeriodLinkList, UploadHoresForm } from "./TraspassPersonalPanel";
import styles from "./page.module.css";

export const metadata = { title: "Traspassos de personal — OpsiaFinance" };

const tab = getDadesTabById("traspass-personal");

async function TraspassPersonalContent() {
  const [session, periods] = await Promise.all([auth(), getTraspassPersonalPeriodsLlista()]);

  const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "EDICIO";

  const items = periods.map((p) => ({
    id: p.id,
    nom: p.nom,
    any: p.any,
    mes: p.mes,
    execucioTraspassPersonal: p.execucioTraspassPersonal,
  }));

  const exportItems = items.map((p) => ({
    nom: p.nom,
    any: p.any,
    mes: p.mes,
    estat: p.execucioTraspassPersonal?.estat ?? null,
    fitxer:
      p.execucioTraspassPersonal?.nomFitxer ??
      p.execucioTraspassPersonal?.importacio?.nomFitxer ??
      null,
  }));

  return (
    <DadesPageShell
      title={tab.title}
      description={
        <>
          {tab.description}{" "}
          <Link href="/dades/traspass-personal/resum" className={styles.resumLink}>
            Veure resum per mes i LN →
          </Link>
        </>
      }
      actions={
        <ExportInformeButton
          informe={
            exportItems.length
              ? periodesToExportInforme(exportItems, {
                  title: tab.title,
                  filename: "dades-traspass-personal",
                  withFitxer: true,
                })
              : null
          }
        />
      }
    >
      <PeriodLinkList periods={items} canEdit={canEdit} />
      <UploadHoresForm canEdit={canEdit} />
    </DadesPageShell>
  );
}

export default function TraspassPersonalLlistaPage() {
  return (
    <Suspense fallback={<RouteLoading label="Carregant traspassos…" />}>
      <TraspassPersonalContent />
    </Suspense>
  );
}
