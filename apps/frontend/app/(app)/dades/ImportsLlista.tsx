"use client";

import { EstatImportBadge } from "@/components/ui/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { type ImportCercaItem, extreureFacetes, filtrarImports } from "@/lib/import-search";
import type { EstatImport } from "@/types";
import { FileSpreadsheet, Search, X } from "lucide-react";
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

  function netejar() {
    setQuery("");
    setLnCodi("");
    setAny("");
    setEstat("");
  }

  return (
    <>
      <div className={styles.cercaWrap}>
        <div className={styles.cercaInputWrap}>
          <Search size={16} className={styles.cercaIcon} />
          <input
            type="search"
            className={styles.cercaInput}
            placeholder="Cerca per fitxer, LN, període, estat… (p.ex. 01_2025 LN00001 gener confirmat)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {teFiltres && (
            <button
              type="button"
              className={styles.cercaClear}
              onClick={netejar}
              aria-label="Netejar cerca"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className={styles.filtresRow}>
          <select
            className={styles.filtreSelect}
            value={lnCodi}
            onChange={(e) => setLnCodi(e.target.value)}
          >
            <option value="">Totes les LN</option>
            {facetes.lns.map((ln) => (
              <option key={ln.codi} value={ln.codi}>
                {ln.codi} · {ln.nom}
              </option>
            ))}
          </select>
          <select
            className={styles.filtreSelect}
            value={any}
            onChange={(e) => setAny(e.target.value)}
          >
            <option value="">Tots els anys</option>
            {facetes.anys.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            className={styles.filtreSelect}
            value={estat}
            onChange={(e) => setEstat(e.target.value)}
          >
            <option value="">Tots els estats</option>
            {facetes.estats.map((e) => (
              <option key={e} value={e}>
                {ESTAT_LABELS[e]}
              </option>
            ))}
          </select>
        </div>

        <p className={styles.cercaResum}>
          {teFiltres
            ? `${filtrats.length} de ${imports.length} importacions`
            : `${imports.length} importació${imports.length !== 1 ? "ns" : ""}`}
        </p>
      </div>

      {filtrats.length === 0 ? (
        <div className={styles.empty}>
          <Search size={36} strokeWidth={1.2} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Cap resultat</p>
          <p className={styles.emptyText}>
            Prova amb altres termes: nom de fitxer (
            <span className="font-mono text-xs">01_2025_00</span>), codi LN (
            <span className="font-mono text-xs">LN00001</span> o{" "}
            <span className="font-mono text-xs">01</span>), mes (
            <span className="font-mono text-xs">gener</span>) o estat (
            <span className="font-mono text-xs">confirmat</span>).
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fitxer</TableHead>
              <TableHead>Línia de negoci</TableHead>
              <TableHead>Tipus d'informe</TableHead>
              <TableHead>Període</TableHead>
              <TableHead>Estat</TableHead>
              <TableHead>Data càrrega</TableHead>
              <TableHead>Pujat per</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrats.map((imp) => (
              <TableRow key={imp.id}>
                <TableCell>
                  <Link href={`/dades/${imp.id}`} className={styles.fileLink}>
                    <FileSpreadsheet size={15} className={styles.fileIcon} />
                    <span className={styles.fileName}>{imp.nomFitxer}</span>
                  </Link>
                </TableCell>
                <TableCell className={styles.meta}>
                  {imp.lnCodi ? (
                    <span title={imp.lnNom ?? undefined}>{imp.lnCodi}</span>
                  ) : (
                    <span className={styles.noData}>—</span>
                  )}
                </TableCell>
                <TableCell className={styles.meta}>
                  {imp.formatNom ?? <span className={styles.noData}>—</span>}
                </TableCell>
                <TableCell className={styles.meta}>
                  {imp.periodNom ?? <span className={styles.noData}>—</span>}
                </TableCell>
                <TableCell>
                  <EstatImportBadge estat={imp.estat} />
                </TableCell>
                <TableCell className={styles.meta}>{imp.dataCarrega}</TableCell>
                <TableCell className={styles.meta}>{imp.autor}</TableCell>
                <TableCell>
                  <ImportRowActions importId={imp.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
