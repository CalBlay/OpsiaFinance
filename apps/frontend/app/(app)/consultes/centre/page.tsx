import { auth } from "@/lib/auth";
import {
  getAnysAmbDades,
  getArbreSeleccio,
  getComparativaLn,
  getCompteExplotacioCentre,
  getCompteExplotacioCentreParell,
} from "@/lib/consultes";
import { etiquetaGrafic } from "@/lib/consultes-grafics";
import { slimConceptsForPaint } from "@/lib/consultes-slim";
import { getInformeCostPersonalCentres } from "@/lib/cost-personal-centre/consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { liniesPerConsultaDetall } from "@/lib/grups-empresa";
import { NODE_COMPRES, NODE_COST_SALARIAL, NODE_EBITDA, NODE_VENDES } from "@/lib/kpi-definitions";
import { MESOS_CURTS } from "@/lib/periodes";
import { parseVistaCompte, vistaInclouTraspassos } from "@/lib/vista-compte";
import { CentreBoard } from "./CentreBoard";
import type { FilaResumCentre, MesCostCentre } from "./CentreResumPresentacio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consulta per centre — OpsiaFinance" };

export default async function ConsultaCentrePage({
  searchParams,
}: {
  searchParams: Promise<{ centre?: string; any?: string; ln?: string; vista?: string }>;
}) {
  const sp = await searchParams;
  const [session, arbreRaw, anys, grup] = await Promise.all([
    auth(),
    getArbreSeleccio(),
    getAnysAmbDades(),
    getGrupEmpresaActual(),
  ]);

  const anyActual = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const vista = parseVistaCompte(sp.vista);
  const arbre = liniesPerConsultaDetall(arbreRaw, grup);
  let lnId = sp.ln ?? null;
  let centreId = sp.centre ?? null;

  if (centreId && !lnId) {
    for (const ln of arbre) {
      if (ln.centres.some((c) => c.id === centreId)) {
        lnId = ln.id;
        break;
      }
    }
  }

  if (lnId && !arbre.some((l) => l.id === lnId)) {
    lnId = null;
    centreId = null;
  }

  if (centreId && lnId) {
    const ln = arbre.find((l) => l.id === lnId);
    if (ln && !ln.centres.some((c) => c.id === centreId)) centreId = null;
  }

  // Directe/SAP primer; capes amb traspassos eager si ja s'han demanat a la URL.
  const parell = centreId
    ? vistaInclouTraspassos(vista)
      ? await getCompteExplotacioCentreParell(centreId, anyActual)
      : {
          sap: vista === "sap" ? await getCompteExplotacioCentre(centreId, anyActual, "sap") : null,
          ajustos:
            vista === "ajustos"
              ? await getCompteExplotacioCentre(centreId, anyActual, "ajustos")
              : null,
          directe:
            vista === "sap" || vista === "ajustos"
              ? null
              : await getCompteExplotacioCentre(centreId, anyActual, "directe"),
          traspassos: null,
          gestio: null,
        }
    : null;

  // Resum de costos per centres de la LN (sense centre triat).
  let resum: {
    lnNom: string;
    totals: {
      costPersonal: number;
      vendes: number;
      personalPctVendes: number | null;
      foodPctVendes: number | null;
      ebitdaPct: number | null;
    };
    cobertura: { ambDades: number; total: number };
    files: FilaResumCentre[];
    evolucioMensual: MesCostCentre[];
    buit: boolean;
  } | null = null;

  if (lnId && !centreId) {
    const ln = arbre.find((l) => l.id === lnId);
    const lnIds = arbre.map((l) => l.id);
    const rangAny = { des: 1, fins: 12 };

    const [informe, cmp] = await Promise.all([
      getInformeCostPersonalCentres(
        lnId,
        anyActual,
        null,
        vistaInclouTraspassos(vista) ? "gestio" : "directe",
        { lnIds }
      ),
      getComparativaLn(lnId, anyActual, rangAny, vista),
    ]);

    const vendesRow = cmp.concepts.find((c) => c.node === NODE_VENDES);
    const personalPlRow = cmp.concepts.find((c) => c.node === NODE_COST_SALARIAL);
    const compresRow = cmp.concepts.find((c) => c.node === NODE_COMPRES);
    const ebitdaRow = cmp.concepts.find((c) => c.node === NODE_EBITDA);

    const plByCentre = new Map<
      string,
      { vendes: number; personal: number; food: number; ebitda: number }
    >();
    cmp.centres.forEach((c, i) => {
      plByCentre.set(c.id, {
        vendes: vendesRow?.valors[i] ?? 0,
        personal: Math.abs(personalPlRow?.valors[i] ?? 0),
        food: Math.abs(compresRow?.valors[i] ?? 0),
        ebitda: ebitdaRow?.valors[i] ?? 0,
      });
    });

    const costById = new Map(informe.barres.map((b) => [b.id, b]));
    const centreIds = new Set([
      ...cmp.centres.map((c) => c.id),
      ...informe.barres.map((b) => b.id).filter((id) => !id.startsWith("__")),
    ]);

    const files: FilaResumCentre[] = [...centreIds]
      .filter((id) => !id.startsWith("__"))
      .map((id) => {
        const barra = costById.get(id);
        const pl = plByCentre.get(id);
        const meta =
          cmp.centres.find((c) => c.id === id) ?? ln?.centres.find((c) => c.id === id) ?? null;
        if (!meta && !barra) return null;

        const vendes = pl?.vendes ?? 0;
        const costPersonal = barra?.costPersonal ?? pl?.personal ?? 0;
        const food = pl?.food ?? 0;
        const ebitda = pl?.ebitda ?? 0;
        const personalPct =
          barra?.pctSobreVendes ?? (vendes ? (costPersonal / Math.abs(vendes)) * 100 : null);
        const foodPct = vendes ? (food / Math.abs(vendes)) * 100 : null;
        const ebitdaPct = vendes ? (ebitda / Math.abs(vendes)) * 100 : null;

        const name = barra?.name ?? (meta ? etiquetaGrafic(meta) : id);

        const params = new URLSearchParams();
        params.set("any", String(anyActual));
        params.set("vista", vista);
        params.set("ln", lnId);
        params.set("centre", id);

        return {
          id,
          name,
          costPersonal,
          pctSobreTotal: barra?.pctSobreTotal ?? null,
          personalPctVendes: personalPct,
          foodPctVendes: foodPct,
          ebitdaPct,
          href: `/consultes/centre?${params}`,
        } satisfies FilaResumCentre;
      })
      .filter((f): f is FilaResumCentre => f != null);

    const vendesFromPl = Math.abs(vendesRow?.total ?? 0);
    const vendesFromFiles = files.reduce(
      (s, f) => s + Math.abs(plByCentre.get(f.id)?.vendes ?? 0),
      0
    );
    const vendesLn = vendesFromPl || vendesFromFiles || Math.abs(informe.totals.vendes);
    const foodLn = files.reduce((s, f) => s + (plByCentre.get(f.id)?.food ?? 0), 0);
    const ebitdaLn = ebitdaRow?.total ?? 0;
    const costPersonal =
      informe.totals.costPersonal || files.reduce((s, f) => s + f.costPersonal, 0);

    resum = {
      lnNom: ln ? etiquetaGrafic(ln) : "Línia",
      totals: {
        costPersonal,
        vendes: vendesLn || informe.totals.vendes,
        personalPctVendes:
          informe.totals.pctSobreVendes ?? (vendesLn ? (costPersonal / vendesLn) * 100 : null),
        foodPctVendes: vendesLn ? (foodLn / vendesLn) * 100 : null,
        ebitdaPct: vendesLn ? (ebitdaLn / vendesLn) * 100 : null,
      },
      cobertura: {
        ambDades: files.filter((f) => f.costPersonal > 0).length,
        total: ln?.centres.length ?? files.length,
      },
      files,
      evolucioMensual: informe.evolucioMensual.map((m) => ({
        label: m.label || MESOS_CURTS[m.mes - 1] || String(m.mes),
        cost: m.costPersonal,
        pctSobreEmpresa: m.pctSobreEmpresa,
      })),
      buit: informe.buit && cmp.buit,
    };
  }

  const lnChooser = !lnId
    ? arbre.map((ln) => {
        const params = new URLSearchParams();
        params.set("any", String(anyActual));
        params.set("vista", vista);
        params.set("ln", ln.id);
        return {
          id: ln.id,
          name: etiquetaGrafic(ln),
          nCentres: ln.centres.length,
          href: `/consultes/centre?${params}`,
        };
      })
    : null;

  return (
    <CentreBoard
      arbre={arbre}
      anys={anys.length ? anys : [anyActual]}
      lnId={lnId}
      centreId={centreId}
      anyActual={anyActual}
      vistaInicial={vista}
      isAdmin={session?.user?.role === "ADMIN"}
      capesInicials={{
        ...(parell?.sap
          ? { sap: { ...parell.sap, concepts: slimConceptsForPaint(parell.sap.concepts) } }
          : {}),
        ...(parell?.ajustos
          ? {
              ajustos: {
                ...parell.ajustos,
                concepts: slimConceptsForPaint(parell.ajustos.concepts),
              },
            }
          : {}),
        ...(parell?.directe
          ? {
              directe: {
                ...parell.directe,
                concepts: slimConceptsForPaint(parell.directe.concepts),
              },
            }
          : {}),
        ...(parell?.traspassos
          ? {
              traspassos: {
                ...parell.traspassos,
                concepts: slimConceptsForPaint(parell.traspassos.concepts),
              },
            }
          : {}),
        ...(parell?.gestio
          ? {
              gestio: {
                ...parell.gestio,
                concepts: slimConceptsForPaint(parell.gestio.concepts),
              },
            }
          : {}),
      }}
      potCarregarCapes={!!centreId && !vistaInclouTraspassos(vista)}
      resum={resum}
      lnChooser={lnChooser}
    />
  );
}
