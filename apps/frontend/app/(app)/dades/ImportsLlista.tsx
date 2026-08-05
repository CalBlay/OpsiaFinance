"use client";

import { DadesFilterBar } from "@/components/dades/DadesFilterBar";
import { DadesEmpty, DadesPanel, dadesUi as ui } from "@/components/dades/DadesPanel";
import { EstatImportBadge } from "@/components/ui/Badge";
import { type ImportCercaItem, extreureFacetes, filtrarImports } from "@/lib/import-search";
import type { EstatImport } from "@/types";
import { FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ImportRowActions } from "./ImportRowActions";
import styles from "./page.module.css";

const ESTAT_LABELS: Record<EstatImport, string> = {
  PENDENT: "Pendent",
  CLASSIFICAT: "Classificat",
  REVISAT: "Revisat",
  CONFIRMAT: "Confirmat",
  ERROR: "Error",
  ARXIVAT: "Arxivat",
};

export function ImportsLlista({ imports }: { imports: ImportCercaItem[] }) {
  const [query, setQuery] = useState("");
  const [lnCodi, setLnCodi] = useState("");
  const [any, setAny] = useState("");
  const [estat, setEstat] = useState("");

  const facetes = useMemo(() => extreureFacetes(imports), [imports]);

  const filtrats = useMemo(
    () => filtrarImports(imports, { query, lnCodi, any, estat }),
    [imports, query, lnCodi, any, estat]
  );

  const teFiltres = !!(query.trim() || lnCodi || any || estat);

  if (!imports.length) {
    return (
      <DadesPanel title="Historial de fitxers">
        <DadesEmpty text="Encara no hi ha importacions. Usa el botó + per pujar el primer Excel." />
      </DadesPanel>
    );
  }

  return (
    <DadesPanel
      title="Historial de fitxers"
      meta={
        teFiltres
          ? `${filtrats.length} de ${imports.length}`
          : `${imports.length} càrrega${imports.length !== 1 ? "s" : ""}`
      }
    >
      <DadesFilterBar
        query={query}
        onQueryChange={setQuery}
        placeholder="Cerca per fitxer, LN, període, estat… (p.ex. 01_2025 LN00001 gener confirmat)"
        filters={[
          {
            id: "ln",
            value: lnCodi,
            onChange: setLnCodi,
            options: facetes.lns.map((ln) => ({
              value: ln.codi,
              label: `${ln.codi} · ${ln.nom}`,
            })),
            allLabel: "Totes les LN",
            "aria-label": "Filtra per línia de negoci",
          },
          {
            id: "any",
            value: any,
            onChange: setAny,
            options: facetes.anys.map((a) => ({ value: String(a), label: String(a) })),
            allLabel: "Tots els anys",
            "aria-label": "Filtra per any",
          },
          {
            id: "estat",
            value: estat,
            onChange: setEstat,
            options: facetes.estats.map((e) => ({ value: e, label: ESTAT_LABELS[e] })),
            allLabel: "Tots els estats",
            "aria-label": "Filtra per estat",
          },
        ]}
      />

      {filtrats.length === 0 ? (
        <DadesEmpty
          title="Cap resultat"
          text="Prova amb altres termes: nom de fitxer, codi LN, mes o estat."
          boxed
        />
      ) : (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Fitxer</th>
                <th>LN</th>
                <th>Format</th>
                <th>Període</th>
                <th>Estat</th>
                <th>Autor</th>
                <th>Data</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtrats.map((imp) => (
                <tr key={imp.id}>
                  <td>
                    <Link href={`/dades/${imp.id}`} className={styles.fileLink}>
                      <FileSpreadsheet size={14} className={styles.fileIcon} />
                      <span className={ui.fileName}>{imp.nomFitxer}</span>
                    </Link>
                  </td>
                  <td className={ui.muted}>{imp.lnCodi ?? "—"}</td>
                  <td className={ui.muted}>{imp.formatNom ?? "—"}</td>
                  <td className={ui.muted}>{imp.periodNom ?? "—"}</td>
                  <td>
                    <EstatImportBadge estat={imp.estat} />
                  </td>
                  <td className={ui.muted}>{imp.autor}</td>
                  <td className={ui.nowrap}>{imp.dataCarrega}</td>
                  <td className={ui.actions}>
                    <ImportRowActions importId={imp.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DadesPanel>
  );
}
