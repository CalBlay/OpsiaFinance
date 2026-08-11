import { esCentreAdministracio } from "@/lib/consultes-grafics";
import { db } from "@/lib/db";
import { NODE_SEGURETAT_SOCIAL, NODE_SOUS_SALARIS } from "@/lib/repartiment/nodes";
import {
  CODI_CENTRE_ADMIN_RESTAURANTS,
  CODI_LN_GREEN_VITA,
  CODI_LN_RESTAURANTS,
  type CostSapAdminRestaurants,
  NOM_NORMA_ADMIN_REST_GREEN_VITA,
  PERCENT_DEFECTE_ADMIN_REST_GREEN_VITA,
} from "@/lib/repartiment/personal-admin-restaurants";

/** Resol el centre Admin de restaurants (codi fix o auto-detecció). */
export async function resoldreCentreAdminRestaurants(): Promise<{
  id: string;
  codi: string;
  nom: string;
} | null> {
  const ln = await db.liniaNegoci.findUnique({
    where: { codi: CODI_LN_RESTAURANTS },
    select: { id: true },
  });
  if (!ln) return null;

  if (CODI_CENTRE_ADMIN_RESTAURANTS) {
    const centre = await db.centre.findFirst({
      where: { liniaNegociId: ln.id, codi: CODI_CENTRE_ADMIN_RESTAURANTS, isActive: true },
      select: { id: true, codi: true, nom: true },
    });
    return centre;
  }

  const centres = await db.centre.findMany({
    where: { liniaNegociId: ln.id, isActive: true },
    select: { id: true, codi: true, nom: true },
    orderBy: { codi: "asc" },
  });
  const admins = centres.filter((c) => esCentreAdministracio(c));
  if (admins.length === 1) return admins[0] ?? null;
  // Preferència: nom conté ADMINISTRACIO
  const preferit = admins.find((c) =>
    c.nom.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().includes("ADMINISTRAC")
  );
  return preferit ?? admins[0] ?? null;
}

/** SAP sous (13) + SS (15) del centre Admin restaurants per període. */
export async function carregarCostSapAdminRestaurants(
  periodId: string
): Promise<CostSapAdminRestaurants | null> {
  const centre = await resoldreCentreAdminRestaurants();
  if (!centre) return null;

  const rows = await db.dadaResultat.findMany({
    where: {
      periodId,
      centreId: centre.id,
      concepteResultat: { node: { in: [NODE_SOUS_SALARIS, NODE_SEGURETAT_SOCIAL] } },
    },
    select: {
      import_: true,
      concepteResultat: { select: { node: true } },
    },
  });

  let sous = 0;
  let seguretatSocial = 0;
  for (const r of rows) {
    const v = Number(r.import_);
    if (r.concepteResultat.node === NODE_SOUS_SALARIS) sous += v;
    else if (r.concepteResultat.node === NODE_SEGURETAT_SOCIAL) seguretatSocial += v;
  }

  // Ajustos manuals del mateix centre × nodes
  const ajustos = await db.ajust.findMany({
    where: {
      periodId,
      centreId: centre.id,
      concepteResultat: { node: { in: [NODE_SOUS_SALARIS, NODE_SEGURETAT_SOCIAL] } },
    },
    select: {
      import_: true,
      concepteResultat: { select: { node: true } },
    },
  });
  for (const a of ajustos) {
    const v = Number(a.import_);
    if (a.concepteResultat.node === NODE_SOUS_SALARIS) sous += v;
    else if (a.concepteResultat.node === NODE_SEGURETAT_SOCIAL) seguretatSocial += v;
  }

  return {
    centreId: centre.id,
    centreCodi: centre.codi,
    centreNom: centre.nom,
    sous,
    seguretatSocial,
  };
}

/** Assegura la norma editable ( % ) a la BD. */
export async function ensureNormaAdminRestGreenVita(): Promise<void> {
  const [lnGv, lnRest] = await Promise.all([
    db.liniaNegoci.findUnique({ where: { codi: CODI_LN_GREEN_VITA }, select: { id: true } }),
    db.liniaNegoci.findUnique({ where: { codi: CODI_LN_RESTAURANTS }, select: { id: true } }),
  ]);
  if (!lnGv || !lnRest) return;

  const existent = await db.normaRepartiment.findFirst({
    where: { nom: NOM_NORMA_ADMIN_REST_GREEN_VITA },
    select: { id: true },
  });
  if (existent) return;

  await db.normaRepartiment.create({
    data: {
      nom: NOM_NORMA_ADMIN_REST_GREEN_VITA,
      tipus: "PERCENT_POOL_CENTRAL",
      ordre: 660,
      actiu: true,
      liniaNegociDestiId: lnGv.id,
      liniaNegociOrigenId: lnRest.id,
      concepteNode: 17,
      valorPercent: PERCENT_DEFECTE_ADMIN_REST_GREEN_VITA,
    },
  });
}
