import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { EstatImportBadge } from "@/components/ui/Badge";
import { auth } from "@/lib/auth";
import { esSubtotalPresentacio, recalcularSubtotalsDetallImport } from "@/lib/compte-subtotals";
import { getArbreSeleccio } from "@/lib/consultes";
import { db } from "@/lib/db";
import { codiLnDelNomFitxer } from "@/lib/nom-fitxer";
import { formatDateShort } from "@/lib/utils";
import type { EstatImport } from "@/types";
import { Calendar, FileText, Tag, User } from "lucide-react";
import { notFound } from "next/navigation";
import { type DadaRow, DadesEditables } from "./DadesEditables";
import { ImportActions } from "./ImportActions";
import { LiniaNegociEditor } from "./LiniaNegociEditor";
import styles from "./page.module.css";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const imp = await db.importacio.findUnique({ where: { id }, select: { nomFitxer: true } });
  return { title: imp ? `${imp.nomFitxer} — OpsiaFinance` : "Importació — OpsiaFinance" };
}

export default async function ImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, imp, arbre, concepts] = await Promise.all([
    auth(),
    db.importacio.findUnique({
      where: { id },
      include: {
        formatInforme: { select: { nom: true } },
        period: { select: { nom: true } },
        liniaNegoci: { select: { id: true, codi: true, nom: true } },
        creatPerUser: { select: { name: true } },
        _count: { select: { dades: true } },
        dades: {
          take: 150,
          orderBy: [{ concepteResultat: { ordre: "asc" } }, { centre: { codi: "asc" } }],
          select: {
            id: true,
            import_: true,
            senseCentre: true,
            liniaNegociId: true,
            concepteResultat: { select: { descripcio: true, esSubtotal: true, node: true } },
            centre: { select: { codi: true, nom: true } },
            liniaNegoci: { select: { codi: true, nom: true } },
          },
        },
      },
    }),
    getArbreSeleccio(),
    db.concepteResultat.findMany({
      where: { isActive: true },
      orderBy: { ordre: "asc" },
      select: { node: true, esSubtotal: true, ordre: true },
    }),
  ]);

  if (!imp) notFound();

  const linies = arbre.map((ln) => ({ id: ln.id, codi: ln.codi, nom: ln.nom }));

  const lnComptador = new Map<string, number>();
  for (const d of imp.dades) {
    if (d.liniaNegociId)
      lnComptador.set(d.liniaNegociId, (lnComptador.get(d.liniaNegociId) ?? 0) + 1);
  }
  let lnDominantId: string | null = null;
  let maxDades = 0;
  for (const [id, count] of lnComptador) {
    if (count > maxDades) {
      maxDades = count;
      lnDominantId = id;
    }
  }
  const lnDominant = lnDominantId ? linies.find((l) => l.id === lnDominantId) : null;
  const codiLnNom = codiLnDelNomFitxer(imp.nomFitxer);
  const avisosLn: string[] = [];
  if (codiLnNom && imp.liniaNegoci && codiLnNom !== imp.liniaNegoci.codi) {
    avisosLn.push(
      `El nom del fitxer («${imp.nomFitxer}») indica ${codiLnNom}, però la importació està assignada a ${imp.liniaNegoci.codi}.`
    );
  }
  if (!imp.liniaNegoci && lnDominant && maxDades > 0) {
    avisosLn.push(
      `Assigneu la línia de negoci de l'informe (suggerit: ${lnDominant.codi} · ${lnDominant.nom}).`
    );
  }

  const _isAdmin = session?.user?.role === "ADMIN";
  const isEditor = session?.user?.role === "ADMIN" || session?.user?.role === "EDICIO";

  const dadesCalc = recalcularSubtotalsDetallImport(
    concepts,
    imp.dades.map((row) => ({
      id: row.id,
      node: row.concepteResultat.node,
      esSubtotal: row.concepteResultat.esSubtotal,
      dimKey: row.senseCentre ? "sc" : (row.centre?.codi ?? row.liniaNegoci?.codi ?? "—"),
      import_: Number(row.import_),
      senseCentre: row.senseCentre,
      descripcio: row.concepteResultat.descripcio,
      dimNom: row.senseCentre
        ? "Sense centre"
        : (row.centre?.nom ?? row.liniaNegoci?.nom ?? row.centre?.codi ?? "—"),
    }))
  );

  return (
    <DadesPageShell
      backHref="/dades"
      backLabel="Importacions"
      title={imp.nomFitxer}
      description={
        <span className={styles.metaRow}>
          <EstatImportBadge estat={imp.estat as EstatImport} />
          {imp.mida ? (
            <span className={styles.metaItem}>{(imp.mida / 1024).toFixed(0)} KB</span>
          ) : null}
        </span>
      }
      actions={
        isEditor ? (
          <ImportActions
            importId={imp.id}
            estat={imp.estat as EstatImport}
            rutaStorage={imp.rutaStorage}
          />
        ) : undefined
      }
    >
      {avisosLn.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Possible confusió de línia de negoci</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {avisosLn.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          {isEditor && (
            <p className="mt-2 text-xs">
              Corregiu la LN a la fitxa de sota abans de confirmar la importació.
            </p>
          )}
        </div>
      )}

      {/* ─── Fitxa de classificació ───────────────────────────── */}
      <div className={styles.card}>
        <div className={styles.cardItem}>
          <Tag size={14} className={styles.cardIcon} />
          <span className={styles.cardLabel}>Tipus d'informe</span>
          <span className={styles.cardValue}>
            {imp.formatInforme?.nom ?? <em className={styles.noData}>Sense classificar</em>}
          </span>
        </div>
        <div className={styles.cardItem}>
          <Calendar size={14} className={styles.cardIcon} />
          <span className={styles.cardLabel}>Període</span>
          <span className={styles.cardValue}>
            {imp.period?.nom ?? <em className={styles.noData}>Sense definir</em>}
          </span>
        </div>
        <div className={styles.cardItem}>
          <Tag size={14} className={styles.cardIcon} />
          <span className={styles.cardLabel}>Línia de negoci</span>
          <LiniaNegociEditor
            importId={imp.id}
            liniaNegociId={imp.liniaNegoci?.id ?? null}
            liniaLabel={imp.liniaNegoci ? `${imp.liniaNegoci.codi} · ${imp.liniaNegoci.nom}` : null}
            linies={linies}
            canEdit={isEditor}
          />
        </div>
        <div className={styles.cardItem}>
          <User size={14} className={styles.cardIcon} />
          <span className={styles.cardLabel}>Pujat per</span>
          <span className={styles.cardValue}>{imp.creatPerUser.name}</span>
        </div>
        <div className={styles.cardItem}>
          <Calendar size={14} className={styles.cardIcon} />
          <span className={styles.cardLabel}>Data càrrega</span>
          <span className={styles.cardValue}>{formatDateShort(imp.createdAt)}</span>
        </div>
        {imp.notes && (
          <div className={styles.cardItem}>
            <FileText size={14} className={styles.cardIcon} />
            <span className={styles.cardLabel}>Notes</span>
            <span className={styles.cardValue}>{imp.notes}</span>
          </div>
        )}
      </div>

      {/* ─── Dades processades ────────────────────────────────── */}
      <div className={styles.rowsSection}>
        <h2 className={styles.sectionTitle}>
          Dades processades
          {imp._count.dades > 0 && <span className={styles.rowCount}>{imp._count.dades}</span>}
        </h2>

        {imp.dades.length === 0 ? (
          <p className={styles.noRows}>
            Encara no hi ha dades processades. Clica «Processar Excel» per llegir el compte de
            resultats i carregar-lo al model financer.
          </p>
        ) : (
          <>
            {isEditor && (
              <p className={styles.editHint}>
                Fes clic a l&apos;import <span className={styles.editHintIcon}>✏</span> d&apos;una
                fila de detall per corregir un valor. Pots escriure una operació (p.ex.{" "}
                <code>122052,81 + 1000</code>). Els subtotals (p.ex. TOTAL COST SALARIAL) es
                recalculen sols a partir de les línies de detall.
              </p>
            )}
            <DadesEditables
              canEdit={isEditor}
              total={imp._count.dades}
              shown={imp.dades.length}
              dades={dadesCalc.map(
                (row): DadaRow => ({
                  id: row.id,
                  import_: row.import_,
                  senseCentre: row.senseCentre,
                  esSubtotal: esSubtotalPresentacio(row.node, row.esSubtotal),
                  descripcio: row.descripcio,
                  dimNom: row.dimNom,
                })
              )}
            />
          </>
        )}
      </div>
    </DadesPageShell>
  );
}
