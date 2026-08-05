import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import { FloatingAddButton } from "@/components/ui/FloatingAddButton";
import { db } from "@/lib/db";
import type { ImportCercaItem } from "@/lib/import-search";
import { formatDateShort } from "@/lib/utils";
import type { EstatImport } from "@/types";
import { ImportsLlista } from "./ImportsLlista";

export const metadata = { title: "Dades — OpsiaFinance" };

const ESTAT_LABELS: Record<EstatImport, string> = {
  PENDENT: "Pendent",
  CLASSIFICAT: "Classificat",
  REVISAT: "Revisat",
  CONFIRMAT: "Confirmat",
  ERROR: "Error",
  ARXIVAT: "Arxivat",
};

const tab = getDadesTabById("importacions");

export default async function DadesPage() {
  const imports = await db.importacio.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
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
    <DadesPageShell title={tab.title} description={tab.description}>
      <ImportsLlista imports={items} />
      <FloatingAddButton href="/dades/nova" label="Nova importació" />
    </DadesPageShell>
  );
}
