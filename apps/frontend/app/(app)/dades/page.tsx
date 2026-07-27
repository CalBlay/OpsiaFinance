import { FloatingAddButton } from "@/components/ui/FloatingAddButton";
import { db } from "@/lib/db";
import type { ImportCercaItem } from "@/lib/import-search";
import { formatDateShort } from "@/lib/utils";
import type { EstatImport } from "@/types";
import { FileSpreadsheet } from "lucide-react";
import { ImportsLlista } from "./ImportsLlista";
import styles from "./page.module.css";

export const metadata = { title: "Dades — OpsiaFinance" };

const ESTAT_LABELS: Record<EstatImport, string> = {
  PENDENT: "Pendent",
  CLASSIFICAT: "Classificat",
  REVISAT: "Revisat",
  CONFIRMAT: "Confirmat",
  ERROR: "Error",
  ARXIVAT: "Arxivat",
};

export default async function DadesPage() {
  const imports = await db.importacio.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      formatInforme: { select: { nom: true, tipusInforme: true } },
      period: { select: { any: true, mes: true, nom: true } },
      liniaNegoci: { select: { codi: true, nom: true } },
      creatPerUser: { select: { name: true } },
    },
  });

  const items: ImportCercaItem[] = imports.map((imp) => ({
    id: imp.id,
    nomFitxer: imp.nomFitxer,
    lnCodi: imp.liniaNegoci?.codi ?? null,
    lnNom: imp.liniaNegoci?.nom ?? null,
    formatNom: imp.formatInforme?.nom ?? null,
    periodNom: imp.period?.nom ?? null,
    periodAny: imp.period?.any ?? null,
    periodMes: imp.period?.mes ?? null,
    estat: imp.estat as EstatImport,
    estatLabel: ESTAT_LABELS[imp.estat as EstatImport] ?? imp.estat,
    autor: imp.creatPerUser.name,
    dataCarrega: formatDateShort(imp.createdAt),
  }));

  return (
    <div className={styles.page}>
      {imports.length === 0 ? (
        <div className={styles.empty}>
          <FileSpreadsheet size={40} strokeWidth={1.2} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Encara no hi ha importacions</p>
          <p className={styles.emptyText}>
            Prem el botó <strong>+</strong> per pujar el primer informe Excel.
          </p>
        </div>
      ) : (
        <ImportsLlista imports={items} />
      )}

      <FloatingAddButton href="/dades/nova" label="Nova importació" />
    </div>
  );
}
