"use client";

import { DadesFilterBar, coincideixCerca } from "@/components/dades/DadesFilterBar";
import {
  DadesBadge,
  DadesEmpty,
  DadesIconBtn,
  DadesPanel,
  dadesUi as ui,
} from "@/components/dades/DadesPanel";
import { FloatingAddButton } from "@/components/ui/FloatingAddButton";
import { formatDateShort } from "@/lib/utils";
import { Eye, FileSpreadsheet, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { deleteExecucioTraspassPersonalAction, uploadHoresTreballAction } from "./actions";

export type TraspassPeriodItem = {
  id: string;
  nom: string;
  any: number;
  mes: number;
  execucioTraspassPersonal: {
    id: string;
    estat: string;
    nomFitxer: string | null;
    createdAt: Date | string;
    importacio: {
      id: string;
      nomFitxer: string;
      createdAt: Date | string;
      creatPerUser: { name: string };
    } | null;
  } | null;
};

export function UploadHoresForm({
  canEdit,
  label = "Pujar Excel d'hores",
}: {
  canEdit: boolean;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; missatge: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!canEdit) return null;

  const pujar = (file: File | null) => {
    if (!file) return;
    const fd = new FormData();
    fd.set("fitxer", file);
    startTransition(async () => {
      const r = await uploadHoresTreballAction(fd);
      setFeedback({ ok: r.ok, missatge: r.missatge });
      if (inputRef.current) inputRef.current.value = "";
      if (r.ok && r.periodId) {
        window.location.href = `/dades/traspass-personal/${r.periodId}`;
      }
    });
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        hidden
        disabled={pending}
        onChange={(e) => pujar(e.target.files?.[0] ?? null)}
      />
      <FloatingAddButton
        label={pending ? "Processant…" : label}
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      />
      {feedback && (
        <p className={feedback.ok ? ui.feedback : ui.feedbackErr}>{feedback.missatge}</p>
      )}
    </>
  );
}

export function PeriodLinkList({
  periods,
  canEdit,
}: {
  periods: TraspassPeriodItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [filtreAny, setFiltreAny] = useState("");
  const [filtreEstat, setFiltreEstat] = useState("");

  const anysOpts = useMemo(() => {
    const set = new Set(periods.map((p) => String(p.any)));
    return [...set].sort((a, b) => Number(b) - Number(a)).map((value) => ({ value, label: value }));
  }, [periods]);

  const filtrats = useMemo(() => {
    return periods.filter((p) => {
      const ex = p.execucioTraspassPersonal;
      if (filtreAny && String(p.any) !== filtreAny) return false;
      if (filtreEstat) {
        const estat = ex?.estat ?? "SENSE";
        if (estat !== filtreEstat) return false;
      }
      const fitxer = ex?.nomFitxer ?? ex?.importacio?.nomFitxer ?? "";
      const usuari = ex?.importacio?.creatPerUser?.name ?? "";
      return coincideixCerca(`${p.nom} ${fitxer} ${usuari} ${ex?.estat ?? ""}`, query);
    });
  }, [periods, query, filtreAny, filtreEstat]);

  const teFiltres = !!(query.trim() || filtreAny || filtreEstat);

  if (!periods.length) {
    return (
      <DadesPanel title="Historial de fitxers">
        <DadesEmpty text="Encara no hi ha imports d'hores. Usa el botó + per pujar l'Excel." />
      </DadesPanel>
    );
  }

  return (
    <DadesPanel
      title="Historial de fitxers"
      meta={
        teFiltres
          ? `${filtrats.length} de ${periods.length}`
          : `${periods.length} càrrega${periods.length !== 1 ? "s" : ""}`
      }
    >
      <DadesFilterBar
        query={query}
        onQueryChange={setQuery}
        placeholder="Cerca fitxer, període, usuari…"
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
            ],
            allLabel: "Tots els estats",
            "aria-label": "Filtra per estat",
          },
        ]}
      />

      {filtrats.length === 0 ? (
        <DadesEmpty text="Cap fitxer amb aquests criteris." />
      ) : (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Fitxer</th>
                <th>Període</th>
                <th>Estat</th>
                <th>Usuari</th>
                <th>Data</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtrats.map((p) => {
                const ex = p.execucioTraspassPersonal;
                const fitxer = ex?.nomFitxer ?? ex?.importacio?.nomFitxer ?? "—";
                const usuari = ex?.importacio?.creatPerUser?.name ?? "—";
                const data = ex?.createdAt
                  ? formatDateShort(
                      typeof ex.createdAt === "string" ? new Date(ex.createdAt) : ex.createdAt
                    )
                  : "—";
                return (
                  <tr key={p.id}>
                    <td>
                      <span className={ui.fileCell}>
                        <FileSpreadsheet size={14} strokeWidth={1.8} />
                        <span className={ui.fileName} title={fitxer}>
                          {fitxer}
                        </span>
                      </span>
                    </td>
                    <td className={ui.nowrap}>{p.nom}</td>
                    <td>
                      {ex?.estat === "CONFIRMAT" ? (
                        <DadesBadge tone="ok">Confirmat</DadesBadge>
                      ) : ex?.estat === "BORRADOR" ? (
                        <DadesBadge tone="warn">Esborrany</DadesBadge>
                      ) : (
                        <DadesBadge>Sense processar</DadesBadge>
                      )}
                    </td>
                    <td>{usuari}</td>
                    <td className={ui.nowrap}>{data}</td>
                    <td className={ui.actions}>
                      <DadesIconBtn
                        label="Obrir / gestionar"
                        href={`/dades/traspass-personal/${p.id}`}
                      >
                        <Eye size={14} />
                      </DadesIconBtn>
                      {canEdit && ex && (
                        <DadesIconBtn
                          label="Eliminar importació"
                          danger
                          disabled={pending}
                          onClick={() => {
                            if (
                              !confirm(`Eliminar la importació de «${p.nom}» i tots els moviments?`)
                            ) {
                              return;
                            }
                            startTransition(async () => {
                              await deleteExecucioTraspassPersonalAction(ex.id);
                              router.refresh();
                            });
                          }}
                        >
                          <Trash2 size={14} />
                        </DadesIconBtn>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DadesPanel>
  );
}
