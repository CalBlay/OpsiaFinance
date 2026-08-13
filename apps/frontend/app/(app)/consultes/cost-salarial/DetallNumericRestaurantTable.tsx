"use client";

import type { CompteCostSalarial } from "@/lib/cost-salarial/compte";
import { vistaUsaForaCentreTraspass } from "@/lib/cost-salarial/compte";
import type { PartidaImport } from "@/lib/cost-salarial/partides";
import { formatNum } from "@/lib/utils";
import { useState } from "react";
import { type ForaCentreDetallContext, ForaCentreDetallModal } from "./ForaCentreDetallModal";
import local from "./page.module.css";

function pctLabel(pct: number | null): string {
  if (pct == null) return "–";
  return `${formatNum(pct, 1)}%`;
}

export function DetallNumericRestaurantTable({
  centreId,
  centreLabel,
  any,
  mes,
  compte,
  partidesTotals,
  partidesSala,
  partidesCuina,
  costTotal,
  salaTotal,
  cuinaTotal,
}: {
  centreId: string;
  centreLabel: string;
  any: number;
  mes: number | null;
  compte: CompteCostSalarial;
  partidesTotals: PartidaImport[];
  partidesSala: PartidaImport[];
  partidesCuina: PartidaImport[];
  costTotal: number;
  salaTotal: number;
  cuinaTotal: number;
}) {
  const [detall, setDetall] = useState<ForaCentreDetallContext | null>(null);

  const openDetall = (departament: "SALA" | "CUINA" | null, cellValue: number) => {
    setDetall({
      centreId,
      centreLabel,
      any,
      mes,
      departament,
      cellValue,
      compte,
    });
  };

  return (
    <>
      <div className={local.tableWrap}>
        <table className={local.table}>
          <thead>
            <tr>
              <th>Partida</th>
              <th className={local.right}>Import</th>
              <th className={local.right}>Pes %</th>
              <th className={local.right}>Sala</th>
              <th className={local.right}>Cuina</th>
            </tr>
          </thead>
          <tbody>
            {partidesTotals.map((p, i) => {
              const sala = partidesSala[i]?.import_ ?? 0;
              const cuina = partidesCuina[i]?.import_ ?? 0;
              const clickable = p.key === "foraCentre";
              const title = vistaUsaForaCentreTraspass(compte)
                ? "Veure detall de traspassos (+destí −origen)"
                : "Veure detall de Fora centre (Excel)";
              return (
                <tr key={p.key}>
                  <td>{p.label}</td>
                  <td className={local.right}>
                    {clickable ? (
                      <button
                        type="button"
                        className={local.cellBtn}
                        onClick={() => openDetall(null, p.import_)}
                        title={title}
                      >
                        {formatNum(p.import_)}
                      </button>
                    ) : (
                      formatNum(p.import_)
                    )}
                  </td>
                  <td className={local.right}>{pctLabel(p.pct)}</td>
                  <td className={local.right}>
                    {clickable ? (
                      <button
                        type="button"
                        className={local.cellBtn}
                        onClick={() => openDetall("SALA", sala)}
                        title={`${title} · Sala`}
                      >
                        {formatNum(sala)}
                      </button>
                    ) : (
                      formatNum(sala)
                    )}
                  </td>
                  <td className={local.right}>
                    {clickable ? (
                      <button
                        type="button"
                        className={local.cellBtn}
                        onClick={() => openDetall("CUINA", cuina)}
                        title={`${title} · Cuina`}
                      >
                        {formatNum(cuina)}
                      </button>
                    ) : (
                      formatNum(cuina)
                    )}
                  </td>
                </tr>
              );
            })}
            <tr className={local.totalRow}>
              <td>Total</td>
              <td className={local.right}>{formatNum(costTotal)}</td>
              <td className={local.right}>100%</td>
              <td className={local.right}>{formatNum(salaTotal)}</td>
              <td className={local.right}>{formatNum(cuinaTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {detall && <ForaCentreDetallModal context={detall} onClose={() => setDetall(null)} />}
    </>
  );
}
