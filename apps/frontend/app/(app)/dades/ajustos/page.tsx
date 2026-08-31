import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import { getAjustosPageData } from "@/lib/ajustos/ajustos-list";
import { auth } from "@/lib/auth";
import { ajustosToExportInforme } from "@/lib/export/dades";
import { Suspense } from "react";
import { AjustosManager } from "./AjustosManager";
import { AjustosSkeleton, PropostaCentralPctSkeleton } from "./AjustosSkeleton";
import { PropostaCentralPctLoader } from "./PropostaCentralPctLoader";

export const metadata = { title: "Ajustos - OpsiaFinance" };

const tab = getDadesTabById("ajustos");

async function AjustosPageContent() {
  const [{ arbre, concepts, ajustos }, session] = await Promise.all([getAjustosPageData(), auth()]);

  const role = session?.user?.role;
  const canEdit = role === "ADMIN" || role === "EDICIO";

  return (
    <DadesPageShell
      title={tab.title}
      description={
        <>
          {tab.description} {ajustos.length} ajust{ajustos.length !== 1 ? "os" : ""}.
        </>
      }
      actions={
        <ExportInformeButton
          informe={ajustos.length ? ajustosToExportInforme(ajustos, { title: tab.title }) : null}
        />
      }
    >
      <Suspense fallback={<PropostaCentralPctSkeleton />}>
        <PropostaCentralPctLoader />
      </Suspense>
      <AjustosManager arbre={arbre} concepts={concepts} ajustos={ajustos} canEdit={canEdit} />
    </DadesPageShell>
  );
}

export default function AjustosPage() {
  return (
    <Suspense fallback={<AjustosSkeleton />}>
      <AjustosPageContent />
    </Suspense>
  );
}
