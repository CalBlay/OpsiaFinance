"use client";

import { DadesFilterBar, coincideixCerca } from "@/components/dades/DadesFilterBar";
import { DadesEmpty, DadesIconBtn, DadesPanel, dadesUi as ui } from "@/components/dades/DadesPanel";
import { FloatingAddButton } from "@/components/ui/FloatingAddButton";
import type { CarregaFitxerLlistaItem } from "@/lib/carrega-fitxer";
import { MESOS_LLARGS } from "@/lib/periodes";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import styles from "../cost-salarial/page.module.css";
import { deleteCarregaPlantillaRrhhAction, uploadPlantillaRrhhAction } from "./actions";

type Registre = {
  id: string;
  nombrePersones: number;
  textOrigen: string | null;
  centreLabel: string;
  centreCodi: string;
  dept: string;
  periodNom: string;
  periodAny: number;
  periodMes: number;
};

type Result = { ok: boolean; missatge: string; errors?: string[] };

export function PlantillaRrhhPanel({
  registres,
  carregues,
  anys,
  filtreAny,
  filtreMes,
  canEdit,
}: {
  registres: Registre[];
  carregues: CarregaFitxerLlistaItem[];
  anys: number[];
  filtreAny: number;
  filtreMes: number | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Result | null>(null);
  const [query, setQuery] = useState("");

  const notify = (r: Result) => {
    setFeedback(r);
    router.refresh();
    if (r.ok) setTimeout(() => setFeedback(null), 10000);
  };

  const aplicarFiltre = (nextAny: string, nextMes: string) => {
    const p = new URLSearchParams();
    if (nextAny) p.set("any", nextAny);
    if (nextMes) p.set("mes", nextMes);
    router.push(`/dades/plantilla-rrhh?${p}`);
  };

  const filtrats = useMemo(() => {
    return registres.filter((r) =>
      coincideixCerca(
        [r.centreLabel, r.centreCodi, r.dept, r.textOrigen, r.periodNom].filter(Boolean).join(" "),
        query
      )
    );
  }, [registres, query]);

  const pujar = (file: File | null) => {
    if (!file) return;
    const fd = new FormData();
    fd.set("fitxer", file);
    startTransition(async () => {
      const r = await uploadPlantillaRrhhAction(fd);
      notify(r);
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  return (
    <>
      {feedback && (
        <div className={cn(styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr)}>
          <div>{feedback.missatge}</div>
          {feedback.errors && feedback.errors.length > 0 && (
            <ul className={styles.errorList}>
              {feedback.errors.slice(0, 8).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {canEdit && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            hidden
            disabled={pending}
            onChange={(e) => pujar(e.target.files?.[0] ?? null)}
          />
          <FloatingAddButton
            label="Pujar Excel de plantilla RRHH"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          />
        </>
      )}

      <div className={styles.toolbar}>
        <DadesFilterBar
          className={styles.filterBar}
          query={query}
          onQueryChange={setQuery}
          placeholder="Cerca centre, departament, organització…"
          onClear={() => {
            setQuery("");
            aplicarFiltre("", "");
          }}
          filters={[
            {
              id: "any",
              value: filtreAny ? String(filtreAny) : "",
              onChange: (v) => aplicarFiltre(v, filtreMes ? String(filtreMes) : ""),
              options: anys.map((y) => ({ value: String(y), label: String(y) })),
              allLabel: "Tots els anys",
              "aria-label": "Filtra per any",
            },
            {
              id: "mes",
              value: filtreMes ? String(filtreMes) : "",
              onChange: (v) => aplicarFiltre(filtreAny ? String(filtreAny) : "", v),
              options: MESOS_LLARGS.map((m, i) => ({
                value: String(i + 1),
                label: m,
              })),
              allLabel: "Tots els mesos",
              "aria-label": "Filtra per mes",
            },
          ]}
          summary={query.trim() ? `${filtrats.length} de ${registres.length} registres` : undefined}
        />
      </div>

      <p className={ui.muted} style={{ marginBottom: "0.75rem" }}>
        Columnes del fitxer: <strong>M1&apos;AAAA</strong> = gener, <strong>M2</strong> = febrer, …
        fins a M12. Només s&apos;importen les fulles amb mapeig (Configuració → Plantilla RRHH). Els
        mesos presents al fitxer es substitueixen.
      </p>

      <DadesPanel title="Registres de plantilla" meta={`${filtrats.length} registres`}>
        {filtrats.length === 0 ? (
          <DadesEmpty text="Encara no hi ha plantilla per aquest filtre. Puja l'Excel amb el botó +." />
        ) : (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Període</th>
                  <th>Centre</th>
                  <th>Departament</th>
                  <th>Organització</th>
                  <th style={{ textAlign: "right" }}>Persones</th>
                </tr>
              </thead>
              <tbody>
                {filtrats.map((r) => (
                  <tr key={r.id}>
                    <td>{r.periodNom}</td>
                    <td>{r.centreLabel}</td>
                    <td>{r.dept}</td>
                    <td className={ui.muted}>{r.textOrigen ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{r.nombrePersones}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DadesPanel>

      <DadesPanel title="Historial de càrregues" meta={`${carregues.length}`}>
        {carregues.length === 0 ? (
          <DadesEmpty text="Encara no s'ha pujat cap fitxer de plantilla." />
        ) : (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Fitxer</th>
                  <th>Data</th>
                  <th>Resum</th>
                  <th>Registres</th>
                  {canEdit && <th />}
                </tr>
              </thead>
              <tbody>
                {carregues.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.nomFitxer}</strong>
                      <div className={ui.muted}>{c.usuari}</div>
                    </td>
                    <td>{c.createdAtLabel}</td>
                    <td className={ui.muted}>{c.resum ?? "—"}</td>
                    <td>{c.registres}</td>
                    {canEdit && (
                      <td>
                        <DadesIconBtn
                          label="Eliminar càrrega i dades"
                          disabled={pending}
                          danger
                          onClick={() => {
                            if (!confirm(`Eliminar «${c.nomFitxer}» i les seves dades?`)) return;
                            startTransition(async () => {
                              notify(await deleteCarregaPlantillaRrhhAction(c.id));
                            });
                          }}
                        >
                          <Trash2 size={15} />
                        </DadesIconBtn>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DadesPanel>
    </>
  );
}
