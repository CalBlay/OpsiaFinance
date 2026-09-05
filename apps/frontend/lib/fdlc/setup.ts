import { db } from "@/lib/db";
import { ensureConceptesCompteBase } from "@/lib/fdlc/conceptes-base";
import { FDLC_LN_CODI, FDLC_LN_NOM } from "@/lib/fdlc/constants";
import { FDLC_NODE_NETEJA, FDLC_NODE_SOFTWARE } from "@/lib/fdlc/mapeig";

export { FDLC_LN_CODI, FDLC_LN_NOM } from "@/lib/fdlc/constants";
export const FDLC_CENTRE_CODI = "CCH00001";
export const FDLC_CENTRE_NOM = "FDLC HOTEL";

/** Assegura LN00007, centre i nodes de detall 46/47 per al parser FDLC. */
export async function ensureFdlcSetup(): Promise<{ lnId: string; centreId: string }> {
  await ensureConceptesCompteBase();

  const ln = await db.liniaNegoci.upsert({
    where: { codi: FDLC_LN_CODI },
    update: {},
    create: { codi: FDLC_LN_CODI, nom: FDLC_LN_NOM },
  });

  const centre = await db.centre.upsert({
    where: { liniaNegociId_codi: { liniaNegociId: ln.id, codi: FDLC_CENTRE_CODI } },
    update: {},
    create: { codi: FDLC_CENTRE_CODI, nom: FDLC_CENTRE_NOM, liniaNegociId: ln.id },
  });

  const ref30 = await db.concepteResultat.findUnique({
    where: { node: 30 },
    select: { ordre: true },
  });
  const ordre46 = ref30 ? ref30.ordre - 2 : 28;
  const ordre47 = ref30 ? ref30.ordre - 1 : 29;

  await db.concepteResultat.upsert({
    where: { node: FDLC_NODE_NETEJA },
    update: {
      descripcio: "NETEJA",
      esSubtotal: false,
      isActive: true,
      ordre: ordre46,
      natura: "FIX",
    },
    create: {
      node: FDLC_NODE_NETEJA,
      descripcio: "NETEJA",
      esSubtotal: false,
      ordre: ordre46,
      natura: "FIX",
    },
  });

  await db.concepteResultat.upsert({
    where: { node: FDLC_NODE_SOFTWARE },
    update: {
      descripcio: "SOFTWARE I SUBSCRIPCIONS",
      esSubtotal: false,
      isActive: true,
      ordre: ordre47,
      natura: "FIX",
    },
    create: {
      node: FDLC_NODE_SOFTWARE,
      descripcio: "SOFTWARE I SUBSCRIPCIONS",
      esSubtotal: false,
      ordre: ordre47,
      natura: "FIX",
    },
  });

  return { lnId: ln.id, centreId: centre.id };
}
