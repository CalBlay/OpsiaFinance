"use client";

import { DadesBadge, DadesEmpty, DadesPanel, dadesUi as ui } from "@/components/dades/DadesPanel";
import { HistorialCarregues } from "@/components/dades/HistorialCarregues";
import { FloatingAddButton } from "@/components/ui/FloatingAddButton";
import type { CarregaFitxerLlistaItem } from "@/lib/carrega-fitxer";
import { MESOS_LLARGS } from "@/lib/periodes";
import { formatNum } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import styles from "../cost-salarial/page.module.css";
import {
  deleteCarregaCostPersonalAction,
  updateNotesCarregaCostPersonalAction,
  uploadCostPersonalCentreAction,
} from "./actions";

type RegistreDTO = {
  id: string;
  centreLabel: string;
  dept: string;
  importBrut: number;
  provisioPaguesExtres: number;
  totalSegSocial: number;
  costPersonal: number;
  textOrigen: string | null;
  periodNom: string;
};

export function CostPersonalCentrePanel({
  canEdit,
  anys,
  filtreAny,
  filtreMes,
  carregues,
  registres,
}: {
  canEdit: boolean;
  anys: number[];
  filtreAny: number;
  filtreMes: number | null;
  carregues: CarregaFitxerLlistaItem[];
  registres: RegistreDTO[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    missatge: string;
    errors?: string[];
  } | null>(null);
  const ara = new Date();

  const anysOpts = useMemo(() => {
    const s = new Set(anys);
    s.add(ara.getFullYear());
    return [...s].sort((a, b) => b - a);
  }, [anys, ara]);

  const pujar = (list: FileList | null) => {
    if (!list?.length) return;
    const fd = new FormData();
    for (const f of Array.from(list)) fd.append("fitxers", f);
    startTransition(async () => {
      const r = await uploadCostPersonalCentreAction(fd);
      setFeedback(r);
      if (fileRef.current) fileRef.current.value = "";
      if (r.ok) router.refresh();
    });
  };

  return (
    <div>
      {feedback && (
        <div
          className={`${styles.feedback} ${feedback.ok ? styles.feedbackOk : styles.feedbackErr}`}
        >
          <p>{feedback.missatge}</p>
          {feedback.errors?.length ? (
            <ul className={styles.errorList}>
              {feedback.errors.slice(0, 8).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {canEdit && (
        <>
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
            label={pending ? "Processant…" : "Pujar Excel de cost personal (un o més)"}
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          />
        </>
      )}

      <HistorialCarregues
        items={carregues}
        canEdit={canEdit}
        onDelete={deleteCarregaCostPersonalAction}
        onSaveNotes={updateNotesCarregaCostPersonalAction}
      />

      <DadesPanel
        title="Registres importats"
        meta={`${filtreAny}${filtreMes ? ` / ${MESOS_LLARGS[filtreMes - 1]}` : ""}`}
      >
        <div className={styles.filters}>
          <select
            className={styles.input}
            value={filtreAny}
            onChange={(e) => {
              const p = new URLSearchParams();
              p.set("any", e.target.value);
              if (filtreMes) p.set("mes", String(filtreMes));
              router.push(`/dades/cost-personal-centre?${p}`);
            }}
          >
            {anysOpts.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            className={styles.input}
            value={filtreMes ?? ""}
            onChange={(e) => {
              const p = new URLSearchParams();
              p.set("any", String(filtreAny));
              if (e.target.value) p.set("mes", e.target.value);
              router.push(`/dades/cost-personal-centre?${p}`);
            }}
          >
            <option value="">Tot l&apos;any</option>
            {MESOS_LLARGS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {!registres.length ? (
          <DadesEmpty text="Cap registre per aquest filtre. Usa el botó + per pujar un o més Excel." />
        ) : (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Període</th>
                  <th>Centre</th>
                  <th>Dept.</th>
                  <th className={ui.right}>Brut</th>
                  <th className={ui.right}>Provisió extres</th>
                  <th className={ui.right}>SS</th>
                  <th className={ui.right}>Cost</th>
                  <th>Origen</th>
                </tr>
              </thead>
              <tbody>
                {registres.map((r) => (
                  <tr key={r.id}>
                    <td>{r.periodNom}</td>
                    <td>{r.centreLabel}</td>
                    <td>{r.dept ? <DadesBadge>{r.dept}</DadesBadge> : "—"}</td>
                    <td className={ui.right}>{formatNum(r.importBrut, 2)}</td>
                    <td className={ui.right}>{formatNum(r.provisioPaguesExtres, 2)}</td>
                    <td className={ui.right}>{formatNum(r.totalSegSocial, 2)}</td>
                    <td className={ui.right}>{formatNum(r.costPersonal, 2)}</td>
                    <td>{r.textOrigen ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DadesPanel>
    </div>
  );
}
