"use client";

import { ConsultaToolbar } from "@/components/consultes/ConsultaToolbar";
import { ConsultaVistaSelect } from "@/components/consultes/ConsultaVistaSelect";
import { FILTRE } from "@/components/consultes/consulta-filtres";
import styles from "@/components/consultes/report.module.css";
import { etiquetaCentre, etiquetaLiniaNegoci } from "@/lib/consultes-etiquetes";
import type { VistaCompte } from "@/lib/vista-compte";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

interface CentreOpt {
  id: string;
  codi: string;
  nom: string;
}

interface LnOpt {
  id: string;
  codi: string;
  nom: string;
  centres: CentreOpt[];
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((id, i) => id === sb[i]);
}

function metaCentre(arbre: LnOpt[], centreId: string): { centre: CentreOpt; ln: LnOpt } | null {
  for (const ln of arbre) {
    const centre = ln.centres.find((c) => c.id === centreId);
    if (centre) return { centre, ln };
  }
  return null;
}

export function ConsolidatCentresSelectors({
  arbre,
  anys,
  centreIds,
  any,
  vista,
  vistesCarregades,
  onVistaLocal,
  vistesOpcions,
}: {
  arbre: LnOpt[];
  anys: number[];
  centreIds: string[];
  any: number;
  vista: VistaCompte;
  vistesCarregades?: VistaCompte[];
  onVistaLocal?: (vista: VistaCompte) => boolean | undefined;
  vistesOpcions?: readonly VistaCompte[] | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<string[]>(centreIds);
  const [lnId, setLnId] = useState<string>("");
  const [centreId, setCentreId] = useState<string>("");

  const anySelectId = "consolidat-centres-any";
  const lnSelectId = "consolidat-centres-ln";
  const centreSelectId = "consolidat-centres-centre";
  const vistaSelectId = "consolidat-centres-vista";

  useEffect(() => {
    setDraft(centreIds);
  }, [centreIds]);

  const lnSeleccionada = arbre.find((ln) => ln.id === lnId) ?? null;
  const centresDisponibles = useMemo(() => {
    if (!lnSeleccionada) return [];
    return lnSeleccionada.centres.filter((c) => !draft.includes(c.id));
  }, [draft, lnSeleccionada]);

  const draftItems = useMemo(
    () =>
      draft
        .map((id) => {
          const meta = metaCentre(arbre, id);
          if (!meta) return null;
          return { id, ...meta };
        })
        .filter((x): x is { id: string; centre: CentreOpt; ln: LnOpt } => x != null),
    [arbre, draft]
  );

  const draftDirty = !sameIds(draft, centreIds);
  const potAfegir = Boolean(centreId) && !draft.includes(centreId);

  const buildUrl = (nextCentres: string[], nextAny: number, nextVista: VistaCompte) => {
    const params = new URLSearchParams();
    params.set("any", String(nextAny));
    if (nextVista !== "directe") params.set("vista", nextVista);
    if (nextCentres.length) params.set("centres", nextCentres.join(","));
    return `/consultes/consolidat-centres?${params}`;
  };

  const go = (nextCentres: string[], nextAny: number, nextVista: VistaCompte) => {
    startTransition(() => {
      router.push(buildUrl(nextCentres, nextAny, nextVista));
    });
  };

  const goVista = (nextVista: VistaCompte) => {
    if (vistesCarregades?.includes(nextVista) && onVistaLocal) {
      const ok = onVistaLocal(nextVista);
      if (ok !== false) return;
    }
    go(centreIds, any, nextVista);
  };

  const afegirCentre = () => {
    if (!centreId || draft.includes(centreId)) return;
    setDraft((prev) => [...prev, centreId]);
    setCentreId("");
    // Manté la LN per si vol afegir un altre centre de la mateixa línia;
    // pot canviar LN i seguir afegint.
  };

  const treureCentre = (id: string) => {
    setDraft((prev) => prev.filter((x) => x !== id));
  };

  const aplicarOk = () => {
    if (!draftDirty) return;
    go(draft, any, vista);
  };

  const netejar = () => {
    setDraft([]);
    setCentreId("");
  };

  return (
    <div className={styles.consolidatPicker}>
      <ConsultaToolbar
        pending={isPending}
        dates={
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={anySelectId}>
              {FILTRE.any}
            </label>
            <select
              id={anySelectId}
              className={styles.select}
              style={{ minWidth: 100 }}
              value={any}
              disabled={isPending}
              onChange={(e) => go(centreIds, Number(e.target.value), vista)}
            >
              {anys.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        }
        camps={
          <>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={lnSelectId}>
                {FILTRE.linia}
              </label>
              <select
                id={lnSelectId}
                className={styles.select}
                style={{ minWidth: 180 }}
                value={lnId}
                disabled={isPending || !arbre.length}
                onChange={(e) => {
                  setLnId(e.target.value);
                  setCentreId("");
                }}
              >
                <option value="">Tria línia…</option>
                {arbre.map((ln) => (
                  <option key={ln.id} value={ln.id}>
                    {etiquetaLiniaNegoci(ln)}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={centreSelectId}>
                {FILTRE.centre}
              </label>
              <select
                id={centreSelectId}
                className={styles.select}
                style={{ minWidth: 180 }}
                value={centreId}
                disabled={isPending || !lnId}
                onChange={(e) => setCentreId(e.target.value)}
              >
                <option value="">{lnId ? "Tria centre…" : "Primer la línia…"}</option>
                {centresDisponibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {etiquetaCentre(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel} aria-hidden>
                &nbsp;
              </span>
              <button
                type="button"
                className={styles.consolidatAddBtn}
                disabled={isPending || !potAfegir}
                onClick={afegirCentre}
                title="Afegir centre a la llista"
              >
                <Plus size={15} strokeWidth={2.2} />
                Afegir
              </button>
            </div>
          </>
        }
        vista={
          <ConsultaVistaSelect
            id={vistaSelectId}
            value={vista}
            onChange={goVista}
            opcions={vistesOpcions ?? undefined}
          />
        }
      />

      <div className={styles.consolidatListRow}>
        {draftItems.length === 0 ? (
          <p className={styles.consolidatHint}>
            Tria línia → centre → <strong>Afegir</strong>. Repeteix i quan tinguis la llista prem{" "}
            <strong>OK</strong>.
          </p>
        ) : (
          <ul className={styles.consolidatChips} aria-label="Centres a consolidar">
            {draftItems.map(({ id, centre, ln }) => (
              <li key={id} className={styles.consolidatChip}>
                <span className={styles.consolidatChipText}>
                  <span className={styles.consolidatChipLn}>{ln.codi}</span>
                  {etiquetaCentre(centre)}
                </span>
                <button
                  type="button"
                  className={styles.consolidatChipRemove}
                  onClick={() => treureCentre(id)}
                  aria-label={`Treure ${etiquetaCentre(centre)}`}
                  disabled={isPending}
                >
                  <X size={13} strokeWidth={2.2} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.consolidatListActions}>
          {draftItems.length > 0 ? (
            <button
              type="button"
              className={styles.multiActionBtn}
              onClick={netejar}
              disabled={isPending}
            >
              Netejar
            </button>
          ) : null}
          <button
            type="button"
            className={styles.consolidatOkBtn}
            onClick={aplicarOk}
            disabled={isPending || !draftDirty}
            title={draftDirty ? "Aplicar la llista al compte" : "Sense canvis a aplicar"}
          >
            OK{draftDirty ? ` (${draft.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
