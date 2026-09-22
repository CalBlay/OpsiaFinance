"use client";

import { DadesFilterBar, coincideixCerca } from "@/components/dades/DadesFilterBar";
import {
  DadesBadge,
  DadesEmpty,
  DadesIconBtn,
  DadesPanel,
  dadesUi as ui,
} from "@/components/dades/DadesPanel";
import { Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  calcularIConfirmarRepartimentAnyAction,
  recalcularIReconfirmarRepartimentAnyAction,
} from "./actions";
import styles from "./page.module.css";

export type RepartimentPeriodItem = {
  id: string;
  nom: string;
  any: number;
  mes: number;
  estat: "CONFIRMAT" | "BORRADOR" | null;
  configuracioAplicada: boolean;
  motiusConfiguracioPendent: string[];
};

export function RepartimentLlista({
  periods,
  canEdit = false,
}: {
  periods: RepartimentPeriodItem[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filtreAny, setFiltreAny] = useState("");
  const [filtreEstat, setFiltreEstat] = useState("");
  const [pending, startTransition] = useTransition();
  const [missatge, setMissatge] = useState<string | null>(null);

  const anysOpts = useMemo(() => {
    const set = new Set(periods.map((p) => String(p.any)));
    return [...set].sort((a, b) => Number(b) - Number(a)).map((value) => ({ value, label: value }));
  }, [periods]);

  const anyDefecte = anysOpts[0]?.value ?? "";
  const [anyMassiu, setAnyMassiu] = useState(anyDefecte);

  const pendentsAny = useMemo(
    () => periods.filter((p) => String(p.any) === anyMassiu && p.estat !== "CONFIRMAT").length,
    [periods, anyMassiu]
  );
  const confirmatsAny = useMemo(
    () => periods.filter((p) => String(p.any) === anyMassiu && p.estat === "CONFIRMAT").length,
    [periods, anyMassiu]
  );
  const confirmatsPendentsConfiguracio = useMemo(
    () =>
      periods.filter(
        (p) => String(p.any) === anyMassiu && p.estat === "CONFIRMAT" && !p.configuracioAplicada
      ).length,
    [periods, anyMassiu]
  );
  const confirmatsAlDia = confirmatsAny > 0 && confirmatsPendentsConfiguracio === 0;

  const filtrats = useMemo(() => {
    return periods.filter((p) => {
      if (filtreAny && String(p.any) !== filtreAny) return false;
      if (filtreEstat) {
        const key = p.estat ?? "SENSE";
        if (key !== filtreEstat) return false;
      }
      return coincideixCerca(`${p.nom} ${p.estat ?? "sense calcular"}`, query);
    });
  }, [periods, query, filtreAny, filtreEstat]);

  const teFiltres = !!(query.trim() || filtreAny || filtreEstat);

  if (!periods.length) {
    return (
      <DadesPanel title="Historial de períodes">
        <DadesEmpty text="Encara no hi ha dades importades per calcular el repartiment." />
      </DadesPanel>
    );
  }

  return (
    <DadesPanel
      title="Historial de períodes"
      meta={
        teFiltres
          ? `${filtrats.length} de ${periods.length}`
          : `${periods.length} període${periods.length !== 1 ? "s" : ""}`
      }
    >
      {canEdit && anysOpts.length > 0 ? (
        <div className={styles.bulkBar}>
          <div className={styles.bulkHead}>
            <label className={styles.bulkLabel} htmlFor="repartiment-any-massiu">
              Any
              <select
                id="repartiment-any-massiu"
                className={styles.bulkSelect}
                value={anyMassiu || anyDefecte}
                onChange={(e) => {
                  const v = e.target.value;
                  setAnyMassiu(v);
                  setFiltreAny(v);
                  setMissatge(null);
                }}
              >
                {anysOpts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div
              className={
                confirmatsPendentsConfiguracio > 0 ? styles.bulkStatusPending : styles.bulkStatusOk
              }
            >
              <strong>
                {confirmatsPendentsConfiguracio > 0
                  ? `${confirmatsPendentsConfiguracio} mes${confirmatsPendentsConfiguracio === 1 ? "" : "os"} confirmat${confirmatsPendentsConfiguracio === 1 ? "" : "s"} sense les regles actuals`
                  : confirmatsAny > 0
                    ? "Regles actuals aplicades"
                    : "Encara no hi ha mesos confirmats"}
              </strong>
              <span>
                {confirmatsPendentsConfiguracio > 0
                  ? "Acció recomanada: aplica les regles noves als confirmats."
                  : confirmatsAny > 0
                    ? `${confirmatsAny} mes${confirmatsAny === 1 ? "" : "os"} confirmat${confirmatsAny === 1 ? "" : "s"} al dia.`
                    : "Calcula primer els mesos nous o pendents."}
              </span>
            </div>
          </div>

          <div className={styles.bulkActions}>
            <section className={styles.bulkActionCard}>
              <div>
                <strong>1. Mesos nous o pendents</strong>
                <p>
                  Calcula i confirma només els mesos que encara no estan confirmats. No modifica
                  resultats anteriors.
                </p>
              </div>
              <button
                type="button"
                className={styles.bulkBtn}
                disabled={pending || !anyMassiu || pendentsAny === 0}
                onClick={() => {
                  const any = Number(anyMassiu);
                  if (
                    !window.confirm(
                      `Calcular i confirmar ${pendentsAny} mes${pendentsAny === 1 ? "" : "os"} pendent${pendentsAny === 1 ? "" : "s"} de ${any}?\n\nEls mesos ja confirmats no es modificaran.`
                    )
                  ) {
                    return;
                  }
                  setMissatge(null);
                  startTransition(async () => {
                    const r = await calcularIConfirmarRepartimentAnyAction(any);
                    setMissatge(r.missatge);
                    router.refresh();
                  });
                }}
              >
                {pending
                  ? "Processant…"
                  : pendentsAny > 0
                    ? `Calcular pendents (${pendentsAny})`
                    : "Cap mes pendent"}
              </button>
            </section>

            <section
              className={`${styles.bulkActionCard} ${
                confirmatsPendentsConfiguracio > 0 ? styles.bulkActionRecommended : ""
              }`}
            >
              <div>
                <strong>2. Aplicar regles noves</strong>
                <p>
                  Recalcula només els mesos confirmats que no incorporen la configuració actual. No
                  toca els que ja estan al dia.
                </p>
              </div>
              <button
                type="button"
                className={confirmatsAlDia ? styles.bulkBtnDone : styles.bulkBtn}
                disabled={pending || !anyMassiu || confirmatsPendentsConfiguracio === 0}
                onClick={() => {
                  const any = Number(anyMassiu);
                  if (
                    !window.confirm(
                      `Aplicar les regles actuals a ${confirmatsPendentsConfiguracio} mes${confirmatsPendentsConfiguracio === 1 ? "" : "os"} confirmat${confirmatsPendentsConfiguracio === 1 ? "" : "s"} de ${any}?\n\nEs recalcularan i es tornaran a confirmar. Els mesos que ja estan al dia no es tocaran.`
                    )
                  ) {
                    return;
                  }
                  setMissatge(null);
                  startTransition(async () => {
                    const r = await recalcularIReconfirmarRepartimentAnyAction(any);
                    setMissatge(r.missatge);
                    router.refresh();
                  });
                }}
              >
                {pending
                  ? "Processant…"
                  : confirmatsPendentsConfiguracio > 0
                    ? `Aplicar regles noves (${confirmatsPendentsConfiguracio})`
                    : confirmatsAny > 0
                      ? "Regles ja aplicades"
                      : "Cap mes confirmat"}
              </button>
            </section>
          </div>
          {missatge ? <p className={styles.bulkMsg}>{missatge}</p> : null}
        </div>
      ) : null}

      <DadesFilterBar
        query={query}
        onQueryChange={setQuery}
        placeholder="Cerca període o estat…"
        filters={[
          {
            id: "any",
            value: filtreAny,
            onChange: setFiltreAny,
            options: anysOpts,
            allLabel: "Tots els anys",
            "aria-label": "Filtra per any",
          },
          {
            id: "estat",
            value: filtreEstat,
            onChange: setFiltreEstat,
            options: [
              { value: "CONFIRMAT", label: "Confirmat" },
              { value: "BORRADOR", label: "Esborrany" },
              { value: "SENSE", label: "Sense calcular" },
            ],
            allLabel: "Tots els estats",
            "aria-label": "Filtra per estat",
          },
        ]}
      />

      {filtrats.length === 0 ? (
        <DadesEmpty text="Cap període amb aquests criteris." />
      ) : (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Període</th>
                <th>Estat</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtrats.map((p) => (
                <tr key={p.id}>
                  <td className={ui.nowrap}>{p.nom}</td>
                  <td>
                    {p.estat === "CONFIRMAT" ? (
                      <div className={styles.periodStatus}>
                        <DadesBadge tone="ok">Confirmat</DadesBadge>
                        {!p.configuracioAplicada ? (
                          <span
                            className={styles.periodPending}
                            title={`Pendent: ${p.motiusConfiguracioPendent.join(", ")}`}
                          >
                            Regles pendents
                          </span>
                        ) : null}
                      </div>
                    ) : p.estat === "BORRADOR" ? (
                      <DadesBadge tone="warn">Esborrany</DadesBadge>
                    ) : (
                      <DadesBadge>Sense calcular</DadesBadge>
                    )}
                  </td>
                  <td className={ui.actions}>
                    <DadesIconBtn label="Obrir / gestionar" href={`/dades/repartiment/${p.id}`}>
                      <Eye size={14} />
                    </DadesIconBtn>
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
