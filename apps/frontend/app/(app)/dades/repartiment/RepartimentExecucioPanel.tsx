"use client";

import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { Button } from "@/components/ui/Button";
import { formatNum } from "@/lib/utils";
import { useTransition } from "react";
import {
  calcularRepartimentAction,
  confirmarRepartimentAction,
  updateMovimentOverrideAction,
  updatePesOverrideAction,
} from "./actions";
import styles from "./page.module.css";

type Execucio = {
  id: string;
  estat: string;
  pesos: {
    id: string;
    vendesBase: number;
    pesCalculat: number;
    pesOverride: number | null;
    liniaNegoci: { codi: string };
    grup: { codi: string };
  }[];
  moviments: {
    id: string;
    concepteNode: number;
    importCalculat: number;
    importOverride: number | null;
    detallCalcul: string | null;
    liniaNegociDesti: { codi: string };
    norma: { nom: string | null; tipus: string } | null;
  }[];
};

export function RepartimentExecucioPanel({
  periodId,
  periodNom,
  execucio,
  canEdit,
}: {
  periodId: string;
  periodNom: string;
  execucio: Execucio | null;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const editable = canEdit && execucio?.estat === "BORRADOR";

  const savePes = (pesId: string, raw: string) => {
    const trimmed = raw.trim();
    const pesOverride =
      trimmed === "" ? null : Math.min(1, Math.max(0, Number(trimmed.replace(",", ".")) / 100));
    startTransition(async () => {
      await updatePesOverrideAction(pesId, pesOverride);
    });
  };

  const saveMoviment = (movimentId: string, raw: string) => {
    const trimmed = raw.trim();
    const importOverride =
      trimmed === "" ? null : Number(trimmed.replace(/\s/g, "").replace(",", "."));
    startTransition(async () => {
      await updateMovimentOverrideAction(movimentId, importOverride);
    });
  };

  return (
    <DadesPageShell
      backHref="/dades/repartiment"
      backLabel="Repartiment"
      title={`Repartiment · ${periodNom}`}
      description={
        execucio ? (
          <span
            className={`${styles.badge} ${
              execucio.estat === "CONFIRMAT" ? styles.badgeConfirmat : styles.badgeBorrador
            }`}
          >
            {execucio.estat === "CONFIRMAT" ? "Confirmat" : "Esborrany"}
          </span>
        ) : (
          "Encara no s’ha calculat el repartiment per aquest període."
        )
      }
      actions={
        canEdit ? (
          <>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await calcularRepartimentAction(periodId);
                })
              }
            >
              {pending ? "Calculant…" : "Calcular / actualitzar"}
            </Button>
            {execucio?.estat === "BORRADOR" && execucio.moviments.length > 0 && (
              <Button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await confirmarRepartimentAction(execucio.id);
                  })
                }
              >
                Confirmar repartiment
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {!execucio ? (
        <p className={styles.muted}>
          Encara no s&apos;ha calculat el repartiment d&apos;aquest mes. Assegura&apos;t que les
          importacions estan confirmades i prem «Calcular».
        </p>
      ) : (
        <>
          {execucio.pesos.length > 0 && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Pesos de vendes (base del repartiment)</h2>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Grup</th>
                    <th>LN</th>
                    <th>Vendes base</th>
                    <th>% calculat</th>
                    {editable && <th>% manual</th>}
                  </tr>
                </thead>
                <tbody>
                  {execucio.pesos.map((p) => (
                    <tr key={p.id}>
                      <td>{p.grup.codi}</td>
                      <td>{p.liniaNegoci.codi}</td>
                      <td className={styles.num}>{formatNum(p.vendesBase)}</td>
                      <td className={styles.num}>{(p.pesCalculat * 100).toFixed(2)}%</td>
                      {editable && (
                        <td>
                          <input
                            className={styles.inlineInput}
                            type="text"
                            defaultValue={
                              p.pesOverride != null ? (p.pesOverride * 100).toFixed(2) : ""
                            }
                            placeholder={(p.pesCalculat * 100).toFixed(2)}
                            disabled={pending}
                            onBlur={(e) => savePes(p.id, e.target.value)}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Moviments de repartiment</h2>
            {execucio.moviments.length === 0 ? (
              <p className={styles.muted}>Cap moviment. Revisa les normes a Configuració.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>LN destí</th>
                    <th>Norma</th>
                    <th>Import</th>
                    {editable && <th>Import manual</th>}
                    <th>Detall</th>
                  </tr>
                </thead>
                <tbody>
                  {execucio.moviments.map((m) => {
                    const imp = m.importOverride ?? m.importCalculat;
                    return (
                      <tr key={m.id}>
                        <td>{m.liniaNegociDesti.codi}</td>
                        <td>{m.norma?.nom ?? m.norma?.tipus ?? "—"}</td>
                        <td className={`${styles.num} ${imp < 0 ? styles.neg : ""}`}>
                          {formatNum(m.importCalculat)}
                        </td>
                        {editable && (
                          <td>
                            <input
                              className={styles.inlineInput}
                              type="text"
                              defaultValue={
                                m.importOverride != null ? String(m.importOverride) : ""
                              }
                              placeholder={String(m.importCalculat)}
                              disabled={pending}
                              onBlur={(e) => saveMoviment(m.id, e.target.value)}
                            />
                          </td>
                        )}
                        <td className={styles.muted}>{m.detallCalcul ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </DadesPageShell>
  );
}
