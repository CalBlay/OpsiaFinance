"use client";

import type { DetallCellaParams, DetallCellaResult } from "@/lib/consultes";
import { etiquetaCentre, etiquetaLiniaNegoci } from "@/lib/consultes-etiquetes";
import type { GrupEmpresa } from "@/lib/grups-empresa";
import { MESOS_LLARGS } from "@/lib/periodes";
import { cn, formatNumSigned } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ajustarImportConsultaAction,
  fetchDetallCellaAction,
} from "../../app/(app)/consultes/actions";
import styles from "./DetallCellaModal.module.css";
import { type PivotEditSave, parseImportInput } from "./PivotTable";
import {
  clearDetallCellaCached,
  detallCellaCacheKey,
  getDetallCellaCached,
  loadDetallCellaCached,
} from "./detall-cella-client-cache";

export interface DetallCellaContext {
  concepteId: string;
  concepteNom: string;
  any: number;
  mes?: number;
  rang?: { des: number; fins: number };
  centreId?: string;
  liniaNegociId?: string;
  lnIdsGrup?: string[];
  vista?: import("@/lib/vista-compte").VistaCompte;
  /** Àmbit d'empresa (calblay / fdlc / consolidat). */
  grup?: GrupEmpresa;
  columnLabel?: string;
  cellValue?: number;
}

export function DetallCellaModal({
  context,
  onClose,
  canEdit = false,
  onSave,
}: {
  context: DetallCellaContext;
  onClose: () => void;
  canEdit?: boolean;
  onSave?: PivotEditSave;
}) {
  const router = useRouter();
  const [data, setData] = useState<DetallCellaResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [motiu, setMotiu] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const mesEditable =
    context.mes ??
    (context.rang && context.rang.des === context.rang.fins ? context.rang.des : undefined);
  const potEditar =
    canEdit &&
    !!mesEditable &&
    (!!context.centreId || !!context.liniaNegociId) &&
    context.vista === "directe";

  const detallParams = useMemo(
    (): DetallCellaParams => ({
      concepteResultatId: context.concepteId,
      any: context.any,
      mes: context.mes,
      rang: context.rang,
      centreId: context.centreId,
      liniaNegociId: context.liniaNegociId,
      lnIdsGrup: context.lnIdsGrup,
      vista: context.vista,
      grup: context.grup,
    }),
    [
      context.concepteId,
      context.any,
      context.mes,
      context.rang,
      context.centreId,
      context.liniaNegociId,
      context.lnIdsGrup,
      context.vista,
      context.grup,
    ]
  );

  const fetchKey = detallCellaCacheKey(detallParams);

  useEffect(() => {
    let active = true;
    const cached = getDetallCellaCached(fetchKey);
    if (cached) {
      setData(cached);
      setIsLoading(false);
      setLoadError(null);
      return;
    }

    setData(null);
    setLoadError(null);
    setIsLoading(true);
    void loadDetallCellaCached(fetchKey, () => fetchDetallCellaAction(detallParams))
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        console.error("[consultes] detall de cel·la failed", err);
        if (active) setLoadError("No s'ha pogut carregar el detall. Torna-ho a provar.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [detallParams, fetchKey]);

  useEffect(() => {
    if (!potEditar) return;
    const base = context.cellValue ?? data?.total ?? 0;
    setDraft(String(base).replace(".", ","));
    setMotiu("");
    setError(null);
  }, [potEditar, context.cellValue, data?.total]);

  const periodeLabel = context.mes
    ? `${MESOS_LLARGS[context.mes - 1]} ${context.any}`
    : context.rang
      ? context.rang.des === context.rang.fins
        ? `${MESOS_LLARGS[context.rang.des - 1]} ${context.any}`
        : `${MESOS_LLARGS[context.rang.des - 1]} – ${MESOS_LLARGS[context.rang.fins - 1]} ${context.any}`
      : `Acumulat ${context.any}`;

  let traspassSortida = 0;
  let traspassEntrada = 0;
  if (data) {
    for (const i of data.items) {
      if (i.origen !== "traspass") continue;
      if (i.import_ > 0) traspassSortida += i.import_;
      else if (i.import_ < 0) traspassEntrada += i.import_;
    }
    traspassSortida = Math.round(traspassSortida * 100) / 100;
    traspassEntrada = Math.round(traspassEntrada * 100) / 100;
  }
  const teTraspass =
    traspassSortida !== 0 || traspassEntrada !== 0 || (data?.totalTraspass ?? 0) !== 0;

  function desarAjust() {
    if (!potEditar || !mesEditable) return;
    const nou = parseImportInput(draft);
    if (nou === null) {
      setError("Valor no vàlid");
      return;
    }
    if (!motiu.trim()) {
      setError("El motiu és obligatori");
      return;
    }
    const actual = context.cellValue ?? data?.total ?? 0;
    if (nou === actual) {
      setError("Sense canvis");
      return;
    }

    const save = onSave ?? ajustarImportConsultaAction;
    startSave(async () => {
      const res = await save({
        centreId: context.centreId,
        liniaNegociId: context.liniaNegociId,
        any: context.any,
        mes: mesEditable,
        concepteResultatId: context.concepteId,
        valorActual: actual,
        valorObjectiu: nou,
        motiu: motiu.trim(),
      });
      if (res.ok) {
        clearDetallCellaCached(fetchKey);
        onClose();
        router.refresh();
      } else {
        setError(res.missatge);
      }
    });
  }

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="presentation"
    >
      <dialog
        className={styles.modal}
        open
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          e.stopPropagation();
        }}
        aria-modal="true"
        aria-labelledby="detall-cella-title"
      >
        <div className={styles.header}>
          <div>
            <h3 id="detall-cella-title" className={styles.title}>
              {context.concepteNom}
            </h3>
            <p className={styles.subtitle}>
              {periodeLabel}
              {context.columnLabel ? ` · ${context.columnLabel}` : ""}
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.summary}>
            <span>
              Total visible:{" "}
              <strong>{formatNumSigned(context.cellValue ?? data?.total ?? 0, 2)}&nbsp;€</strong>
            </span>
          </div>

          {isLoading && !data && <p className={styles.loading}>Carregant detall…</p>}
          {loadError && <p className={styles.empty}>{loadError}</p>}

          {data && (
            <>
              <div className={styles.summary}>
                <span>
                  Dades SAP: <strong>{formatNumSigned(data.totalDades, 2)}&nbsp;€</strong>
                </span>
                {data.totalAjustos !== 0 && (
                  <span>
                    Ajustos:{" "}
                    <strong className={styles.ajust}>
                      {formatNumSigned(data.totalAjustos, 2)}&nbsp;€
                    </strong>
                  </span>
                )}
                {data.totalRepartiment !== 0 && (
                  <span>
                    ESTRUCTURA:{" "}
                    <strong className={styles.repartiment}>
                      {formatNumSigned(data.totalRepartiment, 2)}&nbsp;€
                    </strong>
                  </span>
                )}
                {data.totalMirall !== 0 && (
                  <span>
                    Mirall:{" "}
                    <strong className={styles.mirall}>
                      {formatNumSigned(data.totalMirall, 2)}&nbsp;€
                    </strong>
                  </span>
                )}
                {teTraspass && (
                  <>
                    <span>
                      Sortides:{" "}
                      <strong className={cn(styles.traspass, styles.pos)}>
                        {formatNumSigned(traspassSortida, 2)}&nbsp;€
                      </strong>
                    </span>
                    <span>
                      Entrades:{" "}
                      <strong className={cn(styles.traspass, styles.neg)}>
                        {formatNumSigned(traspassEntrada, 2)}&nbsp;€
                      </strong>
                    </span>
                    <span>
                      Traspass net:{" "}
                      <strong className={styles.traspass}>
                        {formatNumSigned(data.totalTraspass, 2)}&nbsp;€
                      </strong>
                    </span>
                  </>
                )}
                <span>
                  Total: <strong>{formatNumSigned(data.total, 2)}&nbsp;€</strong>
                </span>
              </div>

              {data.items.length === 0 ? (
                <p className={styles.empty}>Sense moviments SAP/ajust per aquest concepte.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Origen</th>
                        <th>Mes</th>
                        <th>Centre</th>
                        <th>Línia</th>
                        <th className={styles.right}>Import</th>
                        <th>Motiu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((item) => (
                        <tr
                          key={`${item.origen}-${item.mes}-${item.centreCodi ?? ""}-${item.liniaCodi ?? ""}-${item.import_}-${item.motiu ?? ""}`}
                          className={
                            item.origen === "ajust"
                              ? styles.ajustRow
                              : item.origen === "repartiment"
                                ? styles.repartimentRow
                                : item.origen === "mirall"
                                  ? styles.mirallRow
                                  : item.origen === "traspass"
                                    ? styles.traspassRow
                                    : item.origen === "payroll"
                                      ? styles.payrollRow
                                      : undefined
                          }
                        >
                          <td>
                            <span
                              className={cn(
                                styles.badge,
                                item.origen === "ajust"
                                  ? styles.badgeAjust
                                  : item.origen === "repartiment"
                                    ? styles.badgeRepartiment
                                    : item.origen === "mirall"
                                      ? styles.badgeMirall
                                      : item.origen === "traspass"
                                        ? styles.badgeTraspass
                                        : item.origen === "payroll"
                                          ? styles.badgePayroll
                                          : styles.badgeDada
                              )}
                            >
                              {item.origen === "dada"
                                ? "SAP"
                                : item.origen === "ajust"
                                  ? "Ajust"
                                  : item.origen === "repartiment"
                                    ? "ESTRUCTURA"
                                    : item.origen === "traspass"
                                      ? "Traspass"
                                      : item.origen === "payroll"
                                        ? "Payroll"
                                        : "Mirall"}
                            </span>
                          </td>
                          <td className={styles.nowrap}>{MESOS_LLARGS[item.mes - 1]}</td>
                          <td>
                            {item.centreCodi || item.centreNom
                              ? etiquetaCentre({ codi: item.centreCodi, nom: item.centreNom })
                              : "—"}
                          </td>
                          <td>
                            {item.liniaCodi || item.liniaNom
                              ? etiquetaLiniaNegoci({
                                  codi: item.liniaCodi,
                                  nom: item.liniaNom,
                                })
                              : "—"}
                          </td>
                          <td
                            className={cn(
                              styles.right,
                              styles.nowrap,
                              item.import_ > 0 && styles.pos,
                              item.import_ < 0 && styles.neg
                            )}
                          >
                            {formatNumSigned(item.import_, 2)} €
                          </td>
                          <td className={styles.motiu}>{item.motiu ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {potEditar && (
                <div className={styles.editSection}>
                  <h4 className={styles.editTitle}>Ajustar import</h4>
                  <p className={styles.editHint}>
                    Es crea un ajust a Dades → Ajustos (delta = nou − actual). Pots escriure una
                    operació (p.ex. <code>122052,81 + 1000</code>).
                  </p>
                  <div className={styles.editRow}>
                    <label className={styles.editField}>
                      <span>Nou import</span>
                      <input
                        ref={inputRef}
                        className={styles.editInput}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        disabled={saving}
                        aria-label="Nou import"
                      />
                    </label>
                    <label className={styles.editField}>
                      <span>Motiu</span>
                      <input
                        className={styles.editInput}
                        value={motiu}
                        onChange={(e) => setMotiu(e.target.value)}
                        disabled={saving}
                        aria-label="Motiu de l'ajust"
                        placeholder="Obligatori"
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.saveBtn}
                      onClick={desarAjust}
                      disabled={saving}
                    >
                      <Check size={14} />
                      Desa ajust
                    </button>
                  </div>
                  {error && <p className={styles.editError}>{error}</p>}
                </div>
              )}
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
