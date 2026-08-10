import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import styles from "@/components/consultes/report.module.css";
import { type VistaCompte, getArbreSeleccio } from "@/lib/consultes";
import {
  getAnysCostPersonalCentre,
  getInformeCostPersonalCentres,
  getInformeCostPersonalDepartaments,
  getInformeCostPersonalLinies,
} from "@/lib/cost-personal-centre/consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { liniesPerConsultaDetall } from "@/lib/grups-empresa";
import { MESOS_LLARGS } from "@/lib/periodes";
import { CostPersonalPresentacio } from "../presenters-dynamic";
import { CostPersonalDetallLazy } from "./CostPersonalDetallLazy";
import { CostPersonalSelectors } from "./CostPersonalSelectors";
import local from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cost de personal — OpsiaFinance" };

function periodeLabel(any: number, mes: number | null): string {
  if (mes == null) return `Acumulat ${any}`;
  return `${MESOS_LLARGS[mes - 1]} ${any}`;
}

export default async function ConsultaCostPersonalPage({
  searchParams,
}: {
  searchParams: Promise<{
    any?: string;
    mes?: string;
    ln?: string;
    centre?: string;
    vista?: string;
  }>;
}) {
  const sp = await searchParams;
  const [arbreRaw, anysCost, grup] = await Promise.all([
    getArbreSeleccio(),
    getAnysCostPersonalCentre(),
    getGrupEmpresaActual(),
  ]);

  const arbre = liniesPerConsultaDetall(arbreRaw, grup);

  const anyCalendari = new Date().getFullYear();
  const anyActual = sp.any
    ? Number(sp.any)
    : anysCost.includes(anyCalendari)
      ? anyCalendari
      : (anysCost[0] ?? anyCalendari);
  const anys = anysCost.length ? anysCost : [anyActual];
  const mes = sp.mes ? Number(sp.mes) : null;
  const vista: VistaCompte = sp.vista === "gestio" ? "gestio" : "directe";

  let lnId = sp.ln && arbre.some((l) => l.id === sp.ln) ? sp.ln : null;
  let centreId = sp.centre ?? null;

  if (centreId && !lnId) {
    for (const ln of arbre) {
      if (ln.centres.some((c) => c.id === centreId)) {
        lnId = ln.id;
        break;
      }
    }
  }

  if (centreId && lnId) {
    const ln = arbre.find((l) => l.id === lnId);
    if (ln && !ln.centres.some((c) => c.id === centreId)) centreId = null;
  }
  if (centreId && !arbre.some((l) => l.centres.some((c) => c.id === centreId))) {
    centreId = null;
  }

  const lnIds = arbre.map((l) => l.id);

  const informe = centreId
    ? await getInformeCostPersonalDepartaments(centreId, anyActual, mes, vista, { lnIds })
    : lnId
      ? await getInformeCostPersonalCentres(lnId, anyActual, mes, vista, { lnIds })
      : await getInformeCostPersonalLinies(anyActual, mes, vista, { lnIds });

  const periode = periodeLabel(anyActual, mes);
  const nivellLabel =
    informe.nivell === "linies"
      ? "Per línia de negoci"
      : informe.nivell === "centres"
        ? "Per centre"
        : "Per departament";

  const chartTitle =
    informe.nivell === "linies"
      ? "On es concentra el cost"
      : informe.nivell === "centres"
        ? "Cost per centre"
        : "Cost per departament";

  const vistaLabel = vista === "gestio" ? "Gestió" : "Directe";

  const crumbs: { label: string; href?: string }[] = [
    {
      label: "Totes les línies",
      href:
        centreId || lnId
          ? `/consultes/cost-personal?any=${anyActual}&vista=${vista}${mes ? `&mes=${mes}` : ""}`
          : undefined,
    },
  ];
  if (lnId) {
    const ln = arbre.find((l) => l.id === lnId);
    crumbs.push({
      label: ln?.nom ?? "Línia",
      href: centreId
        ? `/consultes/cost-personal?ln=${lnId}&any=${anyActual}&vista=${vista}${mes ? `&mes=${mes}` : ""}`
        : undefined,
    });
  }
  if (centreId) {
    const ln = arbre.find((l) => l.id === lnId);
    crumbs.push({ label: ln?.centres.find((c) => c.id === centreId)?.nom ?? "Centre" });
  }

  return (
    <div className={styles.page}>
      <ConsultaHeader
        title="Cost de personal"
        subtitle="Directe = SAP oficial. Gestió = base única + estructura (mateix número que Resultats · Per línia)."
        meta={
          <nav className={local.crumbs} aria-label="Nivell">
            {crumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className={local.crumbItem}>
                {i > 0 && <span className={local.crumbSep}>/</span>}
                {c.href ? (
                  <a href={c.href} className={local.crumbLink}>
                    {c.label}
                  </a>
                ) : (
                  <span className={local.crumbCurrent}>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        }
        actions={
          <CostPersonalSelectors
            arbre={arbre}
            anys={anys}
            lnId={lnId}
            centreId={centreId}
            any={anyActual}
            mes={mes}
            vista={vista}
          />
        }
      />

      {informe.buit ? (
        <div className={styles.prompt}>
          <h3>Sense dades per {periode}</h3>
          <p>
            {vista === "gestio" ? (
              <>
                Puja l&apos;Excel a <a href="/dades/cost-personal-centre">Dades → Cost personal</a>,
                o canvia a Directe.
              </>
            ) : (
              <>No hi ha dades SAP del bloc personal per aquest període.</>
            )}
          </p>
        </div>
      ) : (
        <>
          <CostPersonalPresentacio
            periode={periode}
            titol={informe.titol.replace(/^Cost de personal · /, "")}
            nivellLabel={nivellLabel}
            vistaLabel={vistaLabel}
            totals={informe.totals}
            barres={informe.barres}
            evolucioMensual={informe.evolucioMensual}
            chartTitle={chartTitle}
          />

          <CostPersonalDetallLazy
            params={{
              any: anyActual,
              mes,
              lnId,
              centreId,
              vista,
            }}
            vista={vista}
            grup={grup}
          />
        </>
      )}
    </div>
  );
}
