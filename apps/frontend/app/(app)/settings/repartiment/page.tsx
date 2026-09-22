import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDirectePerLnNode } from "@/lib/repartiment/bases-vendes";
import {
  CODI_LN_CENTRAL,
  NODES_GESTIO_DETALL,
  NODE_COMPRES,
  NODE_COST_GESTIO,
} from "@/lib/repartiment/nodes";
import { syncGrupsRepartiment } from "@/lib/repartiment/normes-default";
import { CODIS_LN_PERSONAL_CONFIG } from "@/lib/repartiment/personal-departaments-constants";
import {
  carregarConfigPersonal,
  carregarCostPersonalDeptSc,
  desactivarNormesPersonalObsoletes,
  ensureConfigPersonalInicial,
} from "@/lib/repartiment/personal-departaments-data";
import { decimalToNumber } from "@/lib/repartiment/serialize";
import { esSuperOAdmin } from "@/lib/roles";
import { RepartimentWorkspace } from "./RepartimentWorkspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Repartiment de costos — OpsiaFinance" };

export default async function RepartimentSettingsPage() {
  const session = await auth();
  const canEdit = esSuperOAdmin(session?.user?.role);

  await syncGrupsRepartiment();
  await ensureConfigPersonalInicial();
  await desactivarNormesPersonalObsoletes();

  const latestPeriod = await db.period.findFirst({
    where: {
      OR: [{ costsPersonalsCentre: { some: {} } }, { dadesResultat: { some: {} } }],
    },
    orderBy: [{ any: "desc" }, { mes: "desc" }],
    select: { id: true, any: true, mes: true, nom: true },
  });

  const refAny = latestPeriod?.any ?? new Date().getFullYear();
  const refMes = latestPeriod?.mes ?? 1;

  const [lns, costs, config, conceptesGestio, normes, directe] = await Promise.all([
    db.liniaNegoci.findMany({
      where: {
        codi: { in: [...CODIS_LN_PERSONAL_CONFIG] },
        isActive: true,
      },
      orderBy: { codi: "asc" },
      select: { id: true, codi: true, nom: true },
    }),
    carregarCostPersonalDeptSc(refAny, refMes),
    carregarConfigPersonal(),
    db.concepteResultat.findMany({
      where: { node: { in: [...NODES_GESTIO_DETALL] }, isActive: true },
      orderBy: { ordre: "asc" },
      select: { node: true, descripcio: true },
    }),
    db.normaRepartiment.findMany({
      where: {
        actiu: true,
        concepteNode: { in: [NODE_COMPRES, NODE_COST_GESTIO, ...NODES_GESTIO_DETALL] },
      },
      orderBy: { ordre: "asc" },
      include: {
        liniaNegociDesti: { select: { codi: true, nom: true } },
        grup: { select: { codi: true, nom: true } },
      },
    }),
    latestPeriod ? getDirectePerLnNode(latestPeriod.id) : Promise.resolve(new Map()),
  ]);

  // Si un centre SC no té departaments i tampoc té cost salarial al mes de referència,
  // no l'hem de mostrar.
  const departaments = costs.map((c) => ({
    departamentId: c.departamentId,
    centreCodi: c.centreCodi,
    centreNom: c.centreNom,
    deptCodi: c.deptCodi,
    deptNom: c.deptNom,
    costRef: c.costPersonal,
  }));

  const central = lns.find((ln) => ln.codi === CODI_LN_CENTRAL);
  const normesGestioDetall = normes.filter((norma) =>
    NODES_GESTIO_DETALL.includes(norma.concepteNode as (typeof NODES_GESTIO_DETALL)[number])
  );
  const normesGestioTotal = normes.filter((norma) => norma.concepteNode === NODE_COST_GESTIO);
  const gestioRows = conceptesGestio.map((concepte) => {
    const percentByLn: Record<string, number> = {};
    for (const ln of lns) {
      const detall = normesGestioDetall.find(
        (norma) => norma.concepteNode === concepte.node && norma.liniaNegociDestiId === ln.id
      );
      const legacy = normesGestioTotal.find((norma) => norma.liniaNegociDestiId === ln.id);
      percentByLn[ln.id] = decimalToNumber(detall?.valorPercent ?? legacy?.valorPercent) ?? 0;
    }
    return {
      node: concepte.node,
      label: concepte.descripcio,
      costRef: central ? Math.abs(directe.get(central.id)?.get(concepte.node) ?? 0) : 0,
      percentByLn,
    };
  });

  const compres = normes
    .filter((norma) => norma.concepteNode === NODE_COMPRES)
    .map((norma) => ({
      id: norma.id,
      nom: norma.nom ?? "Criteri de compres",
      tipus: norma.tipus,
      valorPercent: decimalToNumber(norma.valorPercent),
      liniaNegociDesti: norma.liniaNegociDesti,
      grup: norma.grup,
    }));

  return (
    <RepartimentWorkspace
        linies={lns}
        departaments={departaments}
        assignacions={config.configsDept}
        gestioRows={gestioRows}
        compres={compres}
        refMesLabel={latestPeriod?.nom ?? null}
        canEdit={canEdit}
      />
  );
}
