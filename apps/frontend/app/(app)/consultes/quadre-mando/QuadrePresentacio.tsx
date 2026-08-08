"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import type {
  FilaQuadreRestaurant,
  QuadreMandoRestaurants,
  SemaforPrime,
} from "@/lib/restaurants/quadre-mando";
import { cn, formatNum } from "@/lib/utils";
import { ArrowRight, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./QuadrePresentacio.module.css";

function fmtEuro(v: number | null): string {
  if (v == null) return "—";
  return `${formatNum(v)} €`;
}

function fmtPct(v: number | null, digits = 1): string {
  if (v == null) return "—";
  return `${formatNum(v, digits)}%`;
}

function fmtDelta(v: number | null): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${formatNum(v, 1)}%`;
}

function Semafor({ value }: { value: SemaforPrime }) {
  return (
    <span
      className={cn(styles.semafor, styles[`semafor_${value}`])}
      title={
        value === "verd"
          ? "Cost operatiu ≤ 60%"
          : value === "ambre"
            ? "Cost operatiu 60–65%"
            : value === "vermell"
              ? "Cost operatiu > 65%"
              : "Sense dades suficients"
      }
      aria-label={`Semàfor ${value}`}
    />
  );
}

function KpiTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "warn" | "ok" | "bad" | "neutral";
}) {
  return (
    <div className={cn(styles.kpi, accent && styles[`kpi_${accent}`])}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value}</span>
      {hint ? <span className={styles.kpiHint}>{hint}</span> : null}
    </div>
  );
}

function primeAccent(s: SemaforPrime): "ok" | "warn" | "bad" | "neutral" {
  if (s === "verd") return "ok";
  if (s === "ambre") return "warn";
  if (s === "vermell") return "bad";
  return "neutral";
}

export function QuadrePresentacio({
  data,
  any,
  mes,
}: {
  data: QuadreMandoRestaurants;
  any: number;
  mes: number;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => data.files.find((f) => f.centre.id === selectedId) ?? null,
    [data.files, selectedId]
  );

  const t = data.totals;
  const qVendes = mesQuery(any, mes, "vendes");
  const qCost = mesQuery(any, mes, "cost");

  return (
    <div className={styles.root}>
      <div className={styles.kpiRow}>
        <KpiTile
          label="Vendes TPV"
          value={fmtEuro(t.vendesTpv)}
          hint={t.variacioPct != null ? `Δ ${fmtDelta(t.variacioPct)}` : undefined}
        />
        <KpiTile label="Personal %" value={fmtPct(t.laborPct)} />
        <KpiTile label="Cost de compres %" value={fmtPct(t.foodPct)} />
        <KpiTile
          label="Cost operatiu %"
          value={fmtPct(t.primePct)}
          hint="Objectiu ≤ 60%"
          accent={primeAccent(t.semafor)}
        />
        <KpiTile
          label="EBITDA"
          value={fmtEuro(t.ebitda)}
          hint={t.ebitdaPct != null ? `${fmtPct(t.ebitdaPct)} s/ TPV` : undefined}
        />
        <KpiTile
          label="Desviació TPV − compte"
          value={fmtEuro(t.gapTpvPl)}
          hint={t.gapTpvPlPct != null ? fmtPct(t.gapTpvPlPct) : undefined}
          accent={t.gapTpvPlPct != null && Math.abs(t.gapTpvPlPct) >= 3 ? "warn" : "neutral"}
        />
      </div>

      <p className={styles.meta}>
        {t.centresAmbDades} de {t.centresTotals} restaurants amb dades · {data.periode}
      </p>

      <div className={styles.tableWrap}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>Restaurant</TableHead>
              <TableHead className="text-right">Vendes TPV</TableHead>
              <TableHead className="text-right">Δ%</TableHead>
              <TableHead className="text-right">Personal %</TableHead>
              <TableHead className="text-right">Sala/Cuina</TableHead>
              <TableHead className="text-right">Compres %</TableHead>
              <TableHead className="text-right">Cost operatiu %</TableHead>
              <TableHead className="text-right">EBITDA %</TableHead>
              <TableHead className="text-right">Desviació</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.files.map((f) => (
              <TableRow
                key={f.centre.id}
                className={cn(styles.row, selectedId === f.centre.id && styles.rowSelected)}
                onClick={() => setSelectedId(f.centre.id === selectedId ? null : f.centre.id)}
                style={{ cursor: "pointer" }}
              >
                <TableCell>
                  <Semafor value={f.semafor} />
                </TableCell>
                <TableCell>
                  <span className={styles.restName}>{f.centre.etiqueta}</span>
                  <span className={styles.restCodi}>{f.centre.codi}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmtEuro(f.vendesTpv)}</TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    f.variacioPct != null && f.variacioPct < 0 && styles.neg,
                    f.variacioPct != null && f.variacioPct > 0 && styles.pos
                  )}
                >
                  {fmtDelta(f.variacioPct)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmtPct(f.laborPct)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {f.pctSala != null && f.pctCuina != null
                    ? `${formatNum(f.pctSala, 0)}/${formatNum(f.pctCuina, 0)}`
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmtPct(f.foodPct)}</TableCell>
                <TableCell className={cn("text-right tabular-nums", styles.primeCell)}>
                  {fmtPct(f.primePct)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmtPct(f.ebitdaPct)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtEuro(f.gapTpvPl)}</TableCell>
              </TableRow>
            ))}
            <TableRow className={styles.totalRow}>
              <TableCell>
                <Semafor value={t.semafor} />
              </TableCell>
              <TableCell>
                <strong>Total línia</strong>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <strong>{fmtEuro(t.vendesTpv)}</strong>
              </TableCell>
              <TableCell className="text-right tabular-nums">{fmtDelta(t.variacioPct)}</TableCell>
              <TableCell className="text-right tabular-nums">
                <strong>{fmtPct(t.laborPct)}</strong>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {t.pctSala != null && t.pctCuina != null
                  ? `${formatNum(t.pctSala, 0)}/${formatNum(t.pctCuina, 0)}`
                  : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <strong>{fmtPct(t.foodPct)}</strong>
              </TableCell>
              <TableCell className={cn("text-right tabular-nums", styles.primeCell)}>
                <strong>{fmtPct(t.primePct)}</strong>
              </TableCell>
              <TableCell className="text-right tabular-nums">{fmtPct(t.ebitdaPct)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtEuro(t.gapTpvPl)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {selected ? (
        <FitxaRestaurant
          fila={selected}
          qVendes={qVendes}
          qCost={qCost}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

function FitxaRestaurant({
  fila,
  qVendes,
  qCost,
  onClose,
}: {
  fila: FilaQuadreRestaurant;
  qVendes: string;
  qCost: string;
  onClose: () => void;
}) {
  return (
    <aside className={styles.fitxa} aria-label={`Anàlisi ${fila.centre.etiqueta}`}>
      <div className={styles.fitxaHeader}>
        <div>
          <h3 className={styles.fitxaTitle}>{fila.centre.etiqueta}</h3>
          <p className={styles.fitxaSub}>{fila.centre.codi}</p>
        </div>
        <button type="button" className={styles.fitxaClose} onClick={onClose}>
          Tancar
        </button>
      </div>

      <div className={styles.fitxaKpis}>
        <span>
          Cost operatiu <strong>{fmtPct(fila.primePct)}</strong>
        </span>
        <span>
          Personal <strong>{fmtPct(fila.laborPct)}</strong>
        </span>
        <span>
          Compres <strong>{fmtPct(fila.foodPct)}</strong>
        </span>
        <span>
          EBITDA <strong>{fmtPct(fila.ebitdaPct)}</strong>
        </span>
      </div>

      <div className={styles.comentaris}>
        <p className={styles.comentarisTitle}>
          <MessageSquareText size={14} strokeWidth={2} />
          Lectura analítica
        </p>
        <ul>
          {fila.comentaris.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>

      <div className={styles.fitxaLinks}>
        <Link
          href={`/consultes/vendes-restaurants?vista=restaurant&centre=${fila.centre.id}&${qVendes}`}
          className={styles.fitxaLink}
        >
          Vendes detall
          <ArrowRight size={14} />
        </Link>
        <Link
          href={`/consultes/cost-salarial?vista=restaurant&centre=${fila.centre.id}&${qCost}`}
          className={styles.fitxaLink}
        >
          Cost salarial
          <ArrowRight size={14} />
        </Link>
        <Link href={`/consultes/centre?centre=${fila.centre.id}`} className={styles.fitxaLink}>
          Compte centre
          <ArrowRight size={14} />
        </Link>
      </div>
    </aside>
  );
}

function mesQuery(any: number, mes: number, mode: "vendes" | "cost"): string {
  if (mode === "vendes") {
    return `any=${any}&mes=${mes <= 0 ? 0 : mes}`;
  }
  return mes <= 0 ? `any=${any}` : `any=${any}&mes=${mes}`;
}
