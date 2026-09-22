import { db } from "@/lib/db";

function dataMesRecent(dates: Array<Date | null | undefined>): Date | null {
  let mesRecent: Date | null = null;
  for (const data of dates) {
    if (data && (!mesRecent || data > mesRecent)) mesRecent = data;
  }
  return mesRecent;
}

/** Últim canvi d'una configuració que només afecta mesos amb cost de personal. */
export async function carregarUltimaConfigPersonalUpdatedAt(): Promise<Date | null> {
  const [configLn, configDept, configGlobal] = await Promise.all([
    db.configPersonalLn.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    db.configPersonalDept.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    db.configRepartimentPersonal.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  return dataMesRecent([configLn?.updatedAt, configDept?.updatedAt, configGlobal?.updatedAt]);
}
