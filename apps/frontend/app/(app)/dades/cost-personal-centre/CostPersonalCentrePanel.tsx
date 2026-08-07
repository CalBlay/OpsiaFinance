"use client";

import { DadesBadge, DadesEmpty, DadesPanel, dadesUi as ui } from "@/components/dades/DadesPanel";
import { FloatingAddButton } from "@/components/ui/FloatingAddButton";
import type { CarregaFitxerLlistaItem } from "@/lib/carrega-fitxer";
import { MESOS_LLARGS } from "@/lib/periodes";
import { formatNum } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useRef, useState, useTransition } from "react";
import styles from "../cost-salarial/page.module.css";
import { HistorialCostPersonal } from "./HistorialCostPersonal";
import {
  deleteCarregaCostPersonalAction,
  updateNotesCarregaCostPersonalAction,
  uploadCostPersonalCentreAction,
} from "./actions";

type RegistreDTO = {
  id: string;
  origen: "Nòmina" | "Millores";
  centreLabel: string;
  centreCodi: string;
  dept: string;
  importBrut: number;
  provisioPaguesExtres: number;
  totalSegSocial: number;
  costPersonal: number;
  textOrigen: string | null;
  periodNom: string;
  periodAny: number;
  periodMes: number;
};

type FilConsolida = {
  key: string;
  periodNom: string;
  centreLabel: string;
  centreCodi: string;
  teNomina: boolean;
  teMillores: boolean;
  /** Totes les files (nòmina/millores × dept) del centre×mes. */
  detall: RegistreDTO[];
  importBrut: number;
  provisioPaguesExtres: number;
  totalSegSocial: number;
  costPersonal: number;
};

/**
 * Consolida nòmina + millores per període × centre.
 * No separa per dept: si un origen té Sala i l’altre no, igualment es sumen
 * (informatiu; no alimenta Gestió). El desglossament origen/dept queda al detall.
 */
export function consolidarRegistres(registres: RegistreDTO[]): FilConsolida[] {
  const map = new Map<string, FilConsolida>();
  for (const r of registres) {
    const key = `${r.periodAny}-${String(r.periodMes).padStart(2, "0")}::${r.centreCodi}`;
    let fil = map.get(key);
    if (!fil) {
      fil = {
        key,
        periodNom: r.periodNom,
        centreLabel: r.centreLabel,
        centreCodi: r.centreCodi,
        teNomina: false,
        teMillores: false,
        detall: [],
        importBrut: 0,
        provisioPaguesExtres: 0,
        totalSegSocial: 0,
        costPersonal: 0,
      };
      map.set(key, fil);
    }
    fil.detall.push(r);
    if (r.origen === "Millores") fil.teMillores = true;
    else fil.teNomina = true;
    fil.importBrut += r.importBrut;
    fil.provisioPaguesExtres += r.provisioPaguesExtres;
    fil.totalSegSocial += r.totalSegSocial;
    fil.costPersonal += r.costPersonal;
  }

  const out = [...map.values()];
  for (const fil of out) {
    fil.detall.sort((a, b) => {
      if (a.origen !== b.origen) return a.origen === "Nòmina" ? -1 : 1;
      return a.dept.localeCompare(b.dept, "ca");
    });
  }
  out.sort((a, b) => {
    const pa = a.detall[0];
    const pb = b.detall[0];
    const mesA = pa?.periodMes ?? 0;
    const mesB = pb?.periodMes ?? 0;
    if (mesA !== mesB) return mesB - mesA;
    return a.centreCodi.localeCompare(b.centreCodi, "ca", { numeric: true });
  });
  return out;
}

function etiquetaFonts(fil: FilConsolida): string {
  if (fil.teNomina && fil.teMillores) return "Nòmina + Millores";
  if (fil.teMillores) return "Millores";
  if (fil.teNomina) return "Nòmina";
  return "—";
}

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
  const [oberts, setOberts] = useState<Set<string>>(() => new Set());
  const ara = new Date();

  const anysOpts = useMemo(() => {
    const s = new Set(anys);
    s.add(ara.getFullYear());
    return [...s].sort((a, b) => b - a);
  }, [anys, ara]);

  const consolidats = useMemo(() => consolidarRegistres(registres), [registres]);
  const ambTotsDos = consolidats.filter((c) => c.teNomina && c.teMillores).length;
  const nomesNomina = consolidats.filter((c) => c.teNomina && !c.teMillores).length;
  const nomesMillores = consolidats.filter((c) => c.teMillores && !c.teNomina).length;

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

  const toggle = (key: string) => {
    setOberts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
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
            label={pending ? "Processant…" : "Pujar nòmina o millores (un o més Excel)"}
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          />
        </>
      )}

      <HistorialCostPersonal
        items={carregues}
        canEdit={canEdit}
        onDelete={deleteCarregaCostPersonalAction}
        onSaveNotes={updateNotesCarregaCostPersonalAction}
      />

      <DadesPanel
        title="Registres consolidats (nòmina + millores)"
        meta={`${filtreAny}${filtreMes ? ` / ${MESOS_LLARGS[filtreMes - 1]}` : ""} · ${consolidats.length} centres · ${ambTotsDos} amb tots dos · ${nomesNomina} només nòmina · ${nomesMillores} només millores`}
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

        {!consolidats.length ? (
          <DadesEmpty text="Cap registre per aquest filtre. Usa el botó + per pujar un o més Excel." />
        ) : (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th style={{ width: "2rem" }} />
                  <th>Període</th>
                  <th>Centre</th>
                  <th>Fonts</th>
                  <th className={ui.right}>Brut</th>
                  <th className={ui.right}>Provisió</th>
                  <th className={ui.right}>SS</th>
                  <th className={ui.right}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {consolidats.map((fil) => {
                  const obert = oberts.has(fil.key);
                  const potObrir = fil.detall.length > 1 || (fil.teNomina && fil.teMillores);
                  return (
                    <Fragment key={fil.key}>
                      <tr>
                        <td>
                          {potObrir ? (
                            <button
                              type="button"
                              className={ui.iconBtn}
                              title={obert ? "Amaga detall" : "Mostra detall nòmina / millores"}
                              aria-label={obert ? "Amaga detall" : "Mostra detall"}
                              onClick={() => toggle(fil.key)}
                            >
                              {obert ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          ) : null}
                        </td>
                        <td>{fil.periodNom}</td>
                        <td>{fil.centreLabel}</td>
                        <td>
                          <DadesBadge>{etiquetaFonts(fil)}</DadesBadge>
                        </td>
                        <td className={ui.right}>{formatNum(fil.importBrut, 2)}</td>
                        <td className={ui.right}>{formatNum(fil.provisioPaguesExtres, 2)}</td>
                        <td className={ui.right}>{formatNum(fil.totalSegSocial, 2)}</td>
                        <td className={ui.right}>{formatNum(fil.costPersonal, 2)}</td>
                      </tr>
                      {obert &&
                        fil.detall.map((r) => (
                          <tr key={r.id}>
                            <td />
                            <td className={ui.muted}>{r.dept || "—"}</td>
                            <td className={ui.muted} title={r.textOrigen ?? undefined}>
                              {r.textOrigen ?? "—"}
                            </td>
                            <td>
                              <DadesBadge>{r.origen}</DadesBadge>
                            </td>
                            <td className={ui.right}>{formatNum(r.importBrut, 2)}</td>
                            <td className={ui.right}>{formatNum(r.provisioPaguesExtres, 2)}</td>
                            <td className={ui.right}>{formatNum(r.totalSegSocial, 2)}</td>
                            <td className={ui.right}>{formatNum(r.costPersonal, 2)}</td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DadesPanel>
    </div>
  );
}
