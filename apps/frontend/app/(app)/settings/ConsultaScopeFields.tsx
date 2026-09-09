"use client";

import type { ArbreScopeOpt } from "@/lib/consulta-scope";
import { GRUP_EMPRESA_LABELS, GRUP_EMPRESA_OPCIONS, type GrupEmpresa } from "@/lib/grups-empresa";
import type { NavExtra } from "@/lib/nav-catalog";
import { VISTA_COMPTE_CADENA, type VistaCompte, etiquetaVistaCompte } from "@/lib/vista-compte";
import styles from "./nou/page.module.css";

type Props = {
  arbre: ArbreScopeOpt[];
  value: NavExtra;
  onChange: (next: NavExtra) => void;
  disabled?: boolean;
};

export function ConsultaScopeFields({ arbre, value, onChange, disabled }: Props) {
  const lnIds = new Set(value.scope?.liniaNegociIds ?? []);
  const centreIds = new Set(value.scope?.centreIds ?? []);
  const grups = new Set((value.scope?.grups ?? []) as GrupEmpresa[]);
  const vistes = new Set((value.scope?.vistes ?? []) as VistaCompte[]);

  function patchScope(patch: {
    liniaNegociIds?: string[];
    centreIds?: string[];
    grups?: GrupEmpresa[];
    vistes?: VistaCompte[];
  }) {
    const next: NavExtra = { ...value };
    const liniaNegociIds = patch.liniaNegociIds ?? [...lnIds];
    const centreIdsNext = patch.centreIds ?? [...centreIds];
    const grupsNext = patch.grups ?? [...grups];
    const vistesNext = patch.vistes ?? [...vistes];
    const vistesOrdenades = VISTA_COMPTE_CADENA.filter((v) => vistesNext.includes(v));
    if (
      !liniaNegociIds.length &&
      !centreIdsNext.length &&
      !grupsNext.length &&
      !vistesOrdenades.length
    ) {
      next.scope = undefined;
    } else {
      next.scope = {
        ...(liniaNegociIds.length ? { liniaNegociIds } : {}),
        ...(centreIdsNext.length ? { centreIds: centreIdsNext } : {}),
        ...(grupsNext.length ? { grups: grupsNext } : {}),
        ...(vistesOrdenades.length ? { vistes: [...vistesOrdenades] } : {}),
      };
    }
    onChange(next);
  }

  function toggleLn(ln: ArbreScopeOpt, on: boolean) {
    const nextLn = new Set(lnIds);
    const nextCentres = new Set(centreIds);
    if (on) {
      nextLn.add(ln.id);
      for (const c of ln.centres) nextCentres.add(c.id);
    } else {
      nextLn.delete(ln.id);
      for (const c of ln.centres) nextCentres.delete(c.id);
    }
    patchScope({ liniaNegociIds: [...nextLn], centreIds: [...nextCentres] });
  }

  function toggleCentre(ln: ArbreScopeOpt, centreId: string, on: boolean) {
    const nextLn = new Set(lnIds);
    const nextCentres = new Set(centreIds);
    if (on) {
      nextCentres.add(centreId);
      nextLn.add(ln.id);
    } else {
      nextCentres.delete(centreId);
      const encaraAlgun = ln.centres.some((c) => nextCentres.has(c.id));
      if (!encaraAlgun) nextLn.delete(ln.id);
    }
    patchScope({ liniaNegociIds: [...nextLn], centreIds: [...nextCentres] });
  }

  function toggleGrup(g: GrupEmpresa, on: boolean) {
    const next = new Set(grups);
    if (on) next.add(g);
    else next.delete(g);
    patchScope({ grups: [...next] });
  }

  function toggleVista(v: VistaCompte, on: boolean) {
    const next = new Set(vistes);
    if (on) next.add(v);
    else next.delete(v);
    patchScope({ vistes: [...next] });
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>Àmbit de consulta</span>
      <p className={styles.hint}>
        Empresa, vistes del compte, LN i centres. Per defecte Restauració: Cal Blay, vista Gestió,
        LN00001 i els seus centres.
      </p>

      <div className={styles.extraStack}>
        <div className={styles.extraModul}>
          <p className={styles.extraModulTitle}>Empresa</p>
          <div className={styles.extraSubs}>
            {GRUP_EMPRESA_OPCIONS.map((g) => (
              <label key={g} className={styles.deptRow}>
                <input
                  type="checkbox"
                  checked={grups.has(g)}
                  disabled={disabled}
                  onChange={(e) => toggleGrup(g, e.target.checked)}
                />
                <span>{GRUP_EMPRESA_LABELS[g]}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={styles.extraModul}>
          <p className={styles.extraModulTitle}>Vistes del compte</p>
          <p className={styles.hintInline}>
            Capes SAP → … → Gestió. La primera marcada (preferint Gestió) és la per defecte.
          </p>
          <div className={styles.extraSubs}>
            {VISTA_COMPTE_CADENA.map((v) => (
              <label key={v} className={styles.deptRow}>
                <input
                  type="checkbox"
                  checked={vistes.has(v)}
                  disabled={disabled}
                  onChange={(e) => toggleVista(v, e.target.checked)}
                />
                <span>{etiquetaVistaCompte(v)}</span>
              </label>
            ))}
          </div>
        </div>

        {arbre.map((ln) => {
          const lnOn = lnIds.has(ln.id);
          return (
            <div key={ln.id} className={styles.extraModul}>
              <label className={styles.deptRow}>
                <input
                  type="checkbox"
                  checked={lnOn}
                  disabled={disabled}
                  onChange={(e) => toggleLn(ln, e.target.checked)}
                />
                <span className={styles.deptCodi}>{ln.codi}</span>
                <span className={styles.extraModulTitle}>{ln.nom}</span>
              </label>
              {ln.centres.length > 0 ? (
                <div className={styles.extraSubs}>
                  {ln.centres.map((c) => (
                    <label key={c.id} className={styles.deptRow}>
                      <input
                        type="checkbox"
                        checked={centreIds.has(c.id)}
                        disabled={disabled}
                        onChange={(e) => toggleCentre(ln, c.id, e.target.checked)}
                      />
                      <span className={styles.deptCodi}>{c.codi}</span>
                      <span>{c.nom}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
