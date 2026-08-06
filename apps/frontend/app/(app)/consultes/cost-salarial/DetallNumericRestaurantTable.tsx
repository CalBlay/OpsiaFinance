"use client";

import type { PartidaImport } from "@/lib/cost-salarial/consultes";
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
  partidesTotals: PartidaImport[];
  partidesSala: PartidaImport[];
  partidesCuina: PartidaImport[];
  costTotal: number;
  salaTotal: number;
  cuinaTotal: number;
}) {
  const [detall, setDetall] = useState<ForaCentreDetallContext | null>(null);

  const openFora = (departament: "SALA" | "CUINA" | null, cellValue: number) => {
    setDetall({
      centreId,
      centreLabel,
      any,
      mes,
      departament,
      cellValue,
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
              const isFora = p.key === "foraCentre";
              return (
                <tr key={p.key}>
                  <td>{p.label}</td>
                  <td className={local.right}>
                    {isFora ? (
                      <button
                        type="button"
                        className={local.cellBtn}
                        onClick={() => openFora(null, p.import_)}
                        title="Veure detall de Fora centre"
                      >
                        {formatNum(p.import_)}
                      </button>
                    ) : (
                      formatNum(p.import_)
                    )}
                  </td>
                  <td className={local.right}>{pctLabel(p.pct)}</td>
                  <td className={local.right}>
                    {isFora ? (
                      <button
                        type="button"
                        className={local.cellBtn}
                        onClick={() => openFora("SALA", sala)}
                        title="Detall Fora centre · Sala"
                      >
                        {formatNum(sala)}
                      </button>
                    ) : (
                      formatNum(sala)
                    )}
                  </td>
                  <td className={local.right}>
                    {isFora ? (
                      <button
                        type="button"
                        className={local.cellBtn}
                        onClick={() => openFora("CUINA", cuina)}
                        title="Detall Fora centre · Cuina"
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
