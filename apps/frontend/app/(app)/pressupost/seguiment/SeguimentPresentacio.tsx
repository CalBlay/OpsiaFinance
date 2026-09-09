"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { MESOS_CURTS, MESOS_LLARGS } from "@/lib/periodes";
import type {
  CentreSeguimentOpt,
  SeguimentCentre,
  SeguimentMes,
  SeguimentVendesLn,
} from "@/lib/pressupost/seguiment-vendes-ln";
import { formatNum, formatNumSigned } from "@/lib/utils";
import { useRouter } from "next/navigation";
import styles from "./SeguimentPresentacio.module.css";

export type VistaSeguiment = "mes" | "ln";
export type NivellLn = "general" | "centre";

type Props = {
  data: SeguimentVendesLn;
  anys: number[];
  mes: number;
  lnId: string | null;
  vista: VistaSeguiment;
  nivell: NivellLn;
  centres: CentreSeguimentOpt[];
  centreId: string | null;
  seguimentCentre: SeguimentCentre | null;
};

function DeltaCell({ value, pct }: { value: number; pct: number | null }) {
  const cls = Math.abs(value) < 0.5 ? undefined : value > 0 ? styles.pos : styles.neg;
  return (
    <TableCell className={`text-right tabular-nums ${cls ?? ""}`}>
      <div>{formatNumSigned(value, 0)}</div>
      {pct != null ? <div className={styles.pct}>{formatNumSigned(pct, 1)}%</div> : null}
    </TableCell>
  );
}

function totalMes(files: SeguimentVendesLn["files"], mes: number): SeguimentMes {
  let pressupost = 0;
  let real = 0;
  for (const f of files) {
    const m = f.mesos[mes - 1];
    pressupost += m?.pressupost ?? 0;
    real += m?.real ?? 0;
  }
  const desviacio = real - pressupost;
  const desviacioPct =
    Math.abs(pressupost) < 0.005 ? null : ((real - pressupost) / Math.abs(pressupost)) * 100;
  return { mes, pressupost, real, desviacio, desviacioPct };
}

function totalAny(mesos: SeguimentMes[]): SeguimentMes {
  let pressupost = 0;
  let real = 0;
  for (const m of mesos) {
    pressupost += m.pressupost;
    real += m.real;
  }
  const desviacio = real - pressupost;
  const desviacioPct =
    Math.abs(pressupost) < 0.005 ? null : ((real - pressupost) / Math.abs(pressupost)) * 100;
  return { mes: 0, pressupost, real, desviacio, desviacioPct };
}

export function SeguimentPresentacio({
  data,
  anys,
  mes,
  lnId,
  vista,
  nivell,
  centres,
  centreId,
  seguimentCentre,
}: Props) {
  const router = useRouter();
  const lnActiva = data.files.find((f) => f.liniaNegociId === lnId) ?? data.files[0] ?? null;
  const teCentres = centres.length > 0;
  const centreActiu = centres.find((c) => c.id === centreId) ?? centres[0] ?? null;

  function navegar(patch: {
    any?: number;
    mes?: number;
    ln?: string;
    vista?: VistaSeguiment;
    nivell?: NivellLn;
    centre?: string;
  }) {
    const nextVista = patch.vista ?? vista;
    const nextLn = patch.ln ?? lnActiva?.liniaNegociId;
    const nextNivell = patch.nivell ?? nivell;
    const q = new URLSearchParams();
    q.set("vista", nextVista);
    q.set("any", String(patch.any ?? data.any));
    if (nextVista === "mes") {
      q.set("mes", String(patch.mes ?? mes));
    } else {
      if (nextLn) q.set("ln", nextLn);
      if (teCentres || patch.nivell) {
        q.set("nivell", nextNivell);
        if (nextNivell === "centre") {
          const c = patch.centre ?? centreActiu?.id;
          if (c) q.set("centre", c);
        }
      }
    }
    router.push(`/pressupost/seguiment?${q.toString()}`);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.filters}>
        <fieldset className={styles.vistaToggle}>
          <legend className={styles.srOnly}>Tipus de vista</legend>
          <button
            type="button"
            className={vista === "mes" ? styles.vistaActive : styles.vistaBtn}
            onClick={() => navegar({ vista: "mes" })}
          >
            Per mes
          </button>
          <button
            type="button"
            className={vista === "ln" ? styles.vistaActive : styles.vistaBtn}
            onClick={() =>
              navegar({
                vista: "ln",
                ln: lnActiva?.liniaNegociId ?? data.files[0]?.liniaNegociId,
                nivell: "general",
              })
            }
          >
            Per LN
          </button>
        </fieldset>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Any</span>
          <select
            className={styles.select}
            value={data.any}
            onChange={(e) => navegar({ any: Number(e.target.value) })}
          >
            {anys.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        {vista === "mes" ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Mes</span>
            <select
              className={styles.select}
              value={mes}
              lang="ca"
              translate="no"
              onChange={(e) => navegar({ mes: Number(e.target.value) })}
            >
              {MESOS_LLARGS.map((nom, i) => (
                <option key={nom} value={i + 1}>
                  {nom}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Línia de negoci</span>
              <select
                className={styles.selectWide}
                value={lnActiva?.liniaNegociId ?? ""}
                onChange={(e) => navegar({ ln: e.target.value, nivell: "general" })}
              >
                {data.files.map((f) => (
                  <option key={f.liniaNegociId} value={f.liniaNegociId}>
                    {f.codi} — {f.nom}
                  </option>
                ))}
              </select>
            </label>

            {teCentres ? (
              <>
                <fieldset className={styles.vistaToggle}>
                  <legend className={styles.srOnly}>Nivell</legend>
                  <button
                    type="button"
                    className={nivell === "general" ? styles.vistaActive : styles.vistaBtn}
                    onClick={() => navegar({ nivell: "general" })}
                  >
                    General LN
                  </button>
                  <button
                    type="button"
                    className={nivell === "centre" ? styles.vistaActive : styles.vistaBtn}
                    onClick={() =>
                      navegar({
                        nivell: "centre",
                        centre: centreActiu?.id ?? centres[0]?.id,
                      })
                    }
                  >
                    Per centre
                  </button>
                </fieldset>
                {nivell === "centre" ? (
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Centre</span>
                    <select
                      className={styles.selectWide}
                      value={centreActiu?.id ?? ""}
                      onChange={(e) => navegar({ nivell: "centre", centre: e.target.value })}
                    >
                      {centres.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.codi} — {c.nom}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </>
            ) : null}
          </>
        )}

        <p className={styles.hint}>
          {vista === "mes"
            ? "Totes les LN del mes seleccionat."
            : nivell === "centre" && teCentres
              ? "Tots els mesos del centre seleccionat."
              : "Tots els mesos de la LN (general)."}{" "}
          Real = vista Gestió.
        </p>
      </div>

      {data.files.length === 0 ? (
        <p className={styles.empty}>
          No hi ha pressupost de vendes ni dades reals per a aquest any.
        </p>
      ) : vista === "mes" ? (
        <TaulaPerMes data={data} mes={mes} />
      ) : nivell === "centre" && teCentres ? (
        seguimentCentre ? (
          <TaulaMesos mesos={seguimentCentre.mesos} totalLabel="Total any" />
        ) : (
          <p className={styles.empty}>No s&apos;han pogut carregar les dades del centre.</p>
        )
      ) : lnActiva ? (
        <TaulaMesos mesos={lnActiva.mesos} totalLabel="Total any" />
      ) : (
        <p className={styles.empty}>Selecciona una línia de negoci.</p>
      )}
    </div>
  );
}

function TaulaPerMes({ data, mes }: { data: SeguimentVendesLn; mes: number }) {
  const total = totalMes(data.files, mes);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Línia de negoci</TableHead>
          <TableHead>Estat</TableHead>
          <TableHead className="text-right">Pressupost</TableHead>
          <TableHead className="text-right">Real</TableHead>
          <TableHead className="text-right">Desviació</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.files.map((f) => {
          const m = f.mesos[mes - 1];
          if (!m) return null;
          return (
            <TableRow key={f.liniaNegociId}>
              <TableCell>
                <span className={styles.codi}>{f.codi}</span> {f.nom}
              </TableCell>
              <TableCell>
                {f.estat === "CONFIRMAT"
                  ? "Confirmat"
                  : f.estat === "ESBORRANY"
                    ? "Esborrany"
                    : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNum(m.pressupost, 0)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNum(m.real, 0)}</TableCell>
              <DeltaCell value={m.desviacio} pct={m.desviacioPct} />
            </TableRow>
          );
        })}
        <TableRow className={styles.total}>
          <TableCell colSpan={2}>Total</TableCell>
          <TableCell className="text-right tabular-nums">
            {formatNum(total.pressupost, 0)}
          </TableCell>
          <TableCell className="text-right tabular-nums">{formatNum(total.real, 0)}</TableCell>
          <DeltaCell value={total.desviacio} pct={total.desviacioPct} />
        </TableRow>
      </TableBody>
    </Table>
  );
}

function TaulaMesos({
  mesos,
  totalLabel,
}: {
  mesos: SeguimentMes[];
  totalLabel: string;
}) {
  const total = totalAny(mesos);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mes</TableHead>
          <TableHead className="text-right">Pressupost</TableHead>
          <TableHead className="text-right">Real</TableHead>
          <TableHead className="text-right">Desviació</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {mesos.map((m) => (
          <TableRow key={m.mes}>
            <TableCell lang="ca" translate="no">
              {MESOS_CURTS[m.mes - 1]}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatNum(m.pressupost, 0)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNum(m.real, 0)}</TableCell>
            <DeltaCell value={m.desviacio} pct={m.desviacioPct} />
          </TableRow>
        ))}
        <TableRow className={styles.total}>
          <TableCell>{totalLabel}</TableCell>
          <TableCell className="text-right tabular-nums">
            {formatNum(total.pressupost, 0)}
          </TableCell>
          <TableCell className="text-right tabular-nums">{formatNum(total.real, 0)}</TableCell>
          <DeltaCell value={total.desviacio} pct={total.desviacioPct} />
        </TableRow>
      </TableBody>
    </Table>
  );
}
