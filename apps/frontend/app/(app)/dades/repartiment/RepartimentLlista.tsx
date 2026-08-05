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
import { useMemo, useState } from "react";

export type RepartimentPeriodItem = {
  id: string;
  nom: string;
  any: number;
  mes: number;
  estat: "CONFIRMAT" | "BORRADOR" | null;
};

export function RepartimentLlista({ periods }: { periods: RepartimentPeriodItem[] }) {
  const [query, setQuery] = useState("");
  const [filtreAny, setFiltreAny] = useState("");
  const [filtreEstat, setFiltreEstat] = useState("");

  const anysOpts = useMemo(() => {
    const set = new Set(periods.map((p) => String(p.any)));
    return [...set].sort((a, b) => Number(b) - Number(a)).map((value) => ({ value, label: value }));
  }, [periods]);

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
                      <DadesBadge tone="ok">Confirmat</DadesBadge>
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
