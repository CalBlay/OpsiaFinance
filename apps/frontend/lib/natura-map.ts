import { db } from "@/lib/db";
import type { NaturaByNodeRecord } from "@/lib/punt-equilibri";
import { cache } from "react";

/** Natura actual dels conceptes (config global, no versionada per any). */
export const getMapaNaturaConceptes = cache(async (): Promise<NaturaByNodeRecord> => {
  const rows = await db.concepteResultat.findMany({
    select: { node: true, natura: true, pctVariable: true },
  });
  const out: NaturaByNodeRecord = {};
  for (const r of rows) {
    out[String(r.node)] = { natura: r.natura, pctVariable: r.pctVariable };
  }
  return out;
});
