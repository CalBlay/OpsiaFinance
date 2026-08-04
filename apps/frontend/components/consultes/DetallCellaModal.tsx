"use client";

import type { DetallCellaParams, DetallCellaResult } from "@/lib/consultes";
import { MESOS_LLARGS } from "@/lib/periodes";
import { cn, formatNum } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { fetchDetallCellaAction } from "../../app/(app)/consultes/actions";
import styles from "./DetallCellaModal.module.css";

export interface DetallCellaContext {
  concepteId: string;
  concepteNom: string;
  any: number;
  mes?: number;
  rang?: { des: number; fins: number };
  centreId?: string;
  liniaNegociId?: string;
  lnIdsGrup?: string[];
  columnLabel?: string;
}

export function DetallCellaModal({
  context,
  onClose,
}: {
  context: DetallCellaContext;
  onClose: () => void;
}) {
  const [data, setData] = useState<DetallCellaResult | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const params: DetallCellaParams = {
      concepteResultatId: context.concepteId,
      any: context.any,
      mes: context.mes,
      rang: context.rang,
      centreId: context.centreId,
      liniaNegociId: context.liniaNegociId,
      lnIdsGrup: context.lnIdsGrup,
    };
    startTransition(async () => {
      const result = await fetchDetallCellaAction(params);
      setData(result);
    });
  }, [context]);

  const periodeLabel = context.mes
    ? `${MESOS_LLARGS[context.mes - 1]} ${context.any}`
    : context.rang
      ? context.rang.des === context.rang.fins
        ? `${MESOS_LLARGS[context.rang.des - 1]} ${context.any}`
        : `${MESOS_LLARGS[context.rang.des - 1]} – ${MESOS_LLARGS[context.rang.fins - 1]} ${context.any}`
      : `Acumulat ${context.any}`;

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
          {isPending && <p className={styles.loading}>Carregant detall…</p>}

          {!isPending && data && data.items.length === 0 && (
            <p className={styles.empty}>Sense dades per aquest concepte i període.</p>
          )}

          {!isPending && data && data.items.length > 0 && (
            <>
              <div className={styles.summary}>
                <span>
                  Dades SAP: <strong>{formatNum(data.totalDades, 2)} €</strong>
                </span>
                {data.totalAjustos !== 0 && (
                  <span>
                    Ajustos:{" "}
                    <strong className={styles.ajust}>{formatNum(data.totalAjustos, 2)} €</strong>
                  </span>
                )}
                <span>
                  Total: <strong>{formatNum(data.total, 2)} €</strong>
                </span>
              </div>

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
                        className={item.origen === "ajust" ? styles.ajustRow : undefined}
                      >
                        <td>
                          <span
                            className={cn(
                              styles.badge,
                              item.origen === "ajust" ? styles.badgeAjust : styles.badgeDada
                            )}
                          >
                            {item.origen === "dada" ? "SAP" : "Ajust"}
                          </span>
                        </td>
                        <td className={styles.nowrap}>{MESOS_LLARGS[item.mes - 1]}</td>
                        <td>{item.centreCodi ? `${item.centreCodi} · ${item.centreNom}` : "—"}</td>
                        <td>{item.liniaCodi ? `${item.liniaCodi} · ${item.liniaNom}` : "—"}</td>
                        <td
                          className={cn(
                            styles.right,
                            styles.nowrap,
                            item.import_ < 0 && styles.neg
                          )}
                        >
                          {formatNum(item.import_, 2)} €
                        </td>
                        <td className={styles.motiu}>{item.motiu ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
