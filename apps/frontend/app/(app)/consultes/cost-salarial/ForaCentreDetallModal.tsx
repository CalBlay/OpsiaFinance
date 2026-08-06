"use client";

import type { ForaCentreDetallResultat } from "@/lib/cost-salarial/fora-centre-detall";
import { MESOS_LLARGS } from "@/lib/periodes";
import { formatNum } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import styles from "./ForaCentreDetallModal.module.css";
import { fetchForaCentreDetallAction } from "./actions";

export type ForaCentreDetallContext = {
  centreId: string;
  centreLabel: string;
  any: number;
  mes: number | null;
  departament?: "SALA" | "CUINA" | null;
  cellValue?: number;
};

export function ForaCentreDetallModal({
  context,
  onClose,
}: {
  context: ForaCentreDetallContext;
  onClose: () => void;
}) {
  const [data, setData] = useState<ForaCentreDetallResultat | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const r = await fetchForaCentreDetallAction({
        centreId: context.centreId,
        any: context.any,
        mes: context.mes,
        departament: context.departament ?? null,
      });
      setData(r);
    });
  }, [context]);

  const periode =
    context.mes != null
      ? `${MESOS_LLARGS[context.mes - 1]} ${context.any}`
      : `Acumulat ${context.any}`;
  const deptLabel =
    context.departament === "SALA"
      ? "Sala"
      : context.departament === "CUINA"
        ? "Cuina"
        : "Sala + Cuina";

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
      >
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>Fora centre · {context.centreLabel}</h2>
            <p className={styles.subtitle}>
              {periode} · {deptLabel}
              {data?.teTraspassConfirmat
                ? " · Font: traspassos confirmats"
                : " · Font: Excel cost salarial (sense traspass confirmat)"}
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Tancar">
            <X size={18} />
          </button>
        </header>

        <div className={styles.body}>
          {pending && !data ? (
            <p className={styles.loading}>Carregant detall…</p>
          ) : !data ? (
            <p className={styles.empty}>No s&apos;ha pogut carregar el detall.</p>
          ) : data.linies.length === 0 ? (
            <p className={styles.empty}>Sense moviments de fora centre en aquest període.</p>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Origen</th>
                    <th>Dept.</th>
                    <th className={styles.num}>Minuts</th>
                    <th className={styles.num}>Hores</th>
                    <th className={styles.num}>Import €</th>
                    <th>Font</th>
                  </tr>
                </thead>
                <tbody>
                  {data.linies.map((l, i) => (
                    <tr key={`${l.mes}-${l.origenCodi}-${l.departament}-${i}`}>
                      <td>{MESOS_LLARGS[l.mes - 1] ?? l.periodNom}</td>
                      <td>
                        {l.origenCodi === "—" ? l.origenNom : `${l.origenCodi} · ${l.origenNom}`}
                      </td>
                      <td>{l.departament === "CUINA" ? "Cuina" : "Sala"}</td>
                      <td className={styles.num}>
                        {l.font === "traspass" ? formatNum(l.minuts) : "—"}
                      </td>
                      <td className={styles.num}>
                        {l.font === "traspass" ? formatNum(l.hores) : "—"}
                      </td>
                      <td className={styles.num}>{formatNum(l.import_)}</td>
                      <td>{l.font === "traspass" ? "Traspass" : "Excel"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5}>Total</td>
                    <td className={styles.num}>{formatNum(data.total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              {!data.teTraspassConfirmat && (
                <p className={styles.hint}>
                  Confirma els traspassos a Dades → Traspassos personal perquè Fora centre es
                  substitueixi amb els imports d&apos;entrada (treballadors d&apos;altres centres).
                </p>
              )}
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
