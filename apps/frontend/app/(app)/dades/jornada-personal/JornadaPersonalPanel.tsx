"use client";

import { DadesFilterBar, coincideixCerca } from "@/components/dades/DadesFilterBar";
import { DadesEmpty, DadesIconBtn, DadesPanel, dadesUi as ui } from "@/components/dades/DadesPanel";
import { FloatingAddButton } from "@/components/ui/FloatingAddButton";
import type { CarregaFitxerLlistaItem } from "@/lib/carrega-fitxer";
import type { RegistreJornadaDTO } from "@/lib/jornada-personal/service";
import { MESOS_LLARGS } from "@/lib/periodes";
import { cn, formatNum } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import styles from "../cost-salarial/page.module.css";
import { deleteCarregaJornadaAction, uploadJornadaPersonalAction } from "./actions";

type Result = { ok: boolean; missatge: string; errors?: string[]; avisos?: string[] };

export function JornadaPersonalPanel({
  registres,
  carregues,
  anys,
  filtreAny,
  filtreMes,
  canEdit,
}: {
  registres: RegistreJornadaDTO[];
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
  const ara = new Date();
  const [uploadAny, setUploadAny] = useState(filtreAny || ara.getFullYear());
  const [uploadMes, setUploadMes] = useState(filtreMes || ara.getMonth() + 1);

  const notify = (r: Result) => {
    setFeedback(r);
    router.refresh();
    if (r.ok) setTimeout(() => setFeedback(null), 12000);
  };

  const aplicarFiltre = (nextAny: string, nextMes: string) => {
    const p = new URLSearchParams();
    if (nextAny) p.set("any", nextAny);
    if (nextMes) p.set("mes", nextMes);
    router.push(`/dades/jornada-personal?${p}`);
  };

  const filtrats = useMemo(() => {
    return registres.filter((r) =>
      coincideixCerca([r.centreCodi, r.centreNom, r.dept, r.periodNom].join(" "), query)
    );
  }, [registres, query]);

  const pujar = (list: FileList | null) => {
    if (!list?.length) return;
    const fd = new FormData();
    for (const f of Array.from(list)) fd.append("fitxers", f);
    fd.set("any", String(uploadAny));
    fd.set("mes", String(uploadMes));
    startTransition(async () => {
      const r = await uploadJornadaPersonalAction(fd);
      notify(r);
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  const anysUpload = useMemo(() => {
    const s = new Set(anys);
    s.add(ara.getFullYear());
    s.add(uploadAny);
    return [...s].sort((a, b) => b - a);
  }, [anys, ara, uploadAny]);

  return (
    <>
      {feedback && (
        <div className={cn(styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr)}>
          <div>{feedback.missatge}</div>
          {feedback.avisos && feedback.avisos.length > 0 && (
            <ul className={styles.errorList}>
              {feedback.avisos.slice(0, 6).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
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
          <div className={styles.uploadCard}>
            <div>
              <p className={styles.uploadTitle}>Període d&apos;importació</p>
              <p className={styles.uploadHint}>
                Si el nom del fitxer porta la data (ex. …a 30092026.xls), s&apos;usa aquella. Si no,
                s&apos;aplica l&apos;any i mes seleccionats aquí. Columnes: B = % jornada (blanc =
                40 h), C = codi imputació (mapeig de Cost personal).
              </p>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
                <label
                  className={ui.muted}
                  style={{ display: "flex", gap: 6, alignItems: "center" }}
                >
                  Any
                  <select
                    value={uploadAny}
                    onChange={(e) => setUploadAny(Number(e.target.value))}
                    disabled={pending}
                  >
                    {anysUpload.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
                <label
                  className={ui.muted}
                  style={{ display: "flex", gap: 6, alignItems: "center" }}
                >
                  Mes
                  <select
                    value={uploadMes}
                    onChange={(e) => setUploadMes(Number(e.target.value))}
                    disabled={pending}
                  >
                    {MESOS_LLARGS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            hidden
            disabled={pending}
            onChange={(e) => pujar(e.target.files)}
          />
          <FloatingAddButton
            label="Pujar Excel de jornada"
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
          placeholder="Cerca centre o departament…"
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
          summary={query.trim() ? `${filtrats.length} de ${registres.length}` : undefined}
        />
      </div>

      <DadesPanel title="Caps i hores per centre" meta={`${filtrats.length}`}>
        {filtrats.length === 0 ? (
          <DadesEmpty text="Encara no hi ha dades de jornada. Puja l'Excel mensual amb el botó +." />
        ) : (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Període</th>
                  <th>Centre</th>
                  <th>Departament</th>
                  <th className={ui.right}>Persones</th>
                  <th className={ui.right}>Jornada</th>
                  <th className={ui.right}>Hores / setmana</th>
                </tr>
              </thead>
              <tbody>
                {filtrats.map((r) => (
                  <tr key={r.id}>
                    <td>{r.periodNom}</td>
                    <td>
                      {r.centreCodi}
                      <span className={ui.muted}> · {r.centreNom}</span>
                    </td>
                    <td>{r.dept}</td>
                    <td className={ui.right}>{formatNum(r.nombrePersones, 0)}</td>
                    <td className={ui.right}>{formatNum(r.horesPersona, 1)} h</td>
                    <td className={ui.right}>{formatNum(r.horesSetmanals, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DadesPanel>

      <DadesPanel title="Historial de càrregues" meta={`${carregues.length}`}>
        {carregues.length === 0 ? (
          <DadesEmpty text="Encara no s'ha pujat cap fitxer de jornada." />
        ) : (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Fitxer</th>
                  <th>Període</th>
                  <th>Data</th>
                  <th>Resum</th>
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
                    <td>{c.periodLabel ?? "—"}</td>
                    <td>{c.createdAtLabel}</td>
                    <td className={ui.muted}>{c.resum ?? "—"}</td>
                    {canEdit && (
                      <td>
                        <DadesIconBtn
                          label="Eliminar càrrega i dades"
                          disabled={pending}
                          danger
                          onClick={() => {
                            if (!confirm(`Eliminar «${c.nomFitxer}» i les seves dades?`)) return;
                            startTransition(async () => {
                              const r = await deleteCarregaJornadaAction(c.id);
                              notify(r);
                            });
                          }}
                        >
                          <Trash2 size={14} />
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
