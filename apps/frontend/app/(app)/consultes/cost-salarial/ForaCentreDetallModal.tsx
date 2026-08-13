"use client";

import type { CompteCostSalarial } from "@/lib/cost-salarial/compte";
import { vistaUsaForaCentreTraspass } from "@/lib/cost-salarial/compte";
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
  compte?: CompteCostSalarial;
};

export function ForaCentreDetallModal({
  context,
  onClose,
}: {
  context: ForaCentreDetallContext;
  onClose: () => void;
}) {
  const compte = context.compte ?? "directe";
  const usaTraspass = vistaUsaForaCentreTraspass(compte);
  const [data, setData] = useState<ForaCentreDetallResultat | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const r = await fetchForaCentreDetallAction({
        centreId: context.centreId,
        any: context.any,
        mes: context.mes,
        departament: context.departament ?? null,
        compte,
      });
      setData(r);
    });
  }, [context, compte]);

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

  const titol = usaTraspass
    ? `Fora centre · traspassos · ${context.centreLabel}`
    : `Fora centre · Excel · ${context.centreLabel}`;

  const fontLabel = usaTraspass
    ? data?.teTraspassConfirmat
      ? " · Font: traspassos confirmats (+destí −origen)"
      : " · Sense traspass confirmat"
    : " · Font: Excel cost salarial";

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
            <h2 className={styles.title}>{titol}</h2>
            <p className={styles.subtitle}>
              {periode} · {deptLabel}
              {fontLabel}
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
            <p className={styles.empty}>
              {usaTraspass
                ? "Sense traspassos confirmats en aquest període."
                : "Sense valor de Fora centre a l'Excel en aquest període."}
            </p>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Mes</th>
                    {usaTraspass ? <th>Rol</th> : null}
                    <th>{usaTraspass ? "Centre" : "Concepte"}</th>
                    <th>Dept.</th>
                    <th className={styles.num}>Minuts</th>
                    <th className={styles.num}>Hores</th>
                    <th className={styles.num}>Import €</th>
                    <th>Font</th>
                  </tr>
                </thead>
                <tbody>
                  {data.linies.map((l, i) => {
                    const aquestEsOrigen = l.origenCodi === data.centreCodi;
                    const centreCell = !usaTraspass
                      ? l.origenCodi === "—"
                        ? l.origenNom
                        : `${l.origenCodi} · ${l.origenNom}`
                      : aquestEsOrigen
                        ? l.destiCodi === "—"
                          ? l.destiNom
                          : `${l.destiCodi} · ${l.destiNom}`
                        : l.origenCodi === "—"
                          ? l.origenNom
                          : `${l.origenCodi} · ${l.origenNom}`;
                    const rolLabel =
                      l.rol === "origen" ? "Origen (−)" : l.rol === "desti" ? "Destí (+)" : "—";
                    return (
                      <tr
                        key={`${l.mes}-${l.rol}-${l.origenCodi}-${l.destiCodi}-${l.departament}-${i}`}
                      >
                        <td>{MESOS_LLARGS[l.mes - 1] ?? l.periodNom}</td>
                        {usaTraspass ? <td>{rolLabel}</td> : null}
                        <td>{centreCell}</td>
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
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={usaTraspass ? 6 : 5}>Total</td>
                    <td className={styles.num}>{formatNum(data.total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              {usaTraspass ? (
                <p className={styles.hint}>
                  Traspassos / Gestió: suma les hores d&apos;entrada (destí, +) i resta les de
                  sortida (origen, −). Cal traspass confirmat a Dades → Traspassos personal.
                </p>
              ) : (
                <p className={styles.hint}>
                  SAP / Directe: valor del camp Fora centre de l&apos;Excel de cost salarial.
                </p>
              )}
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
