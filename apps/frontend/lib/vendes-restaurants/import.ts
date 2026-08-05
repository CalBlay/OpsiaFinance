import { crearCarregaFitxer } from "@/lib/carrega-fitxer";
import type { TipusCarregaFitxer } from "@/lib/carrega-fitxer";
import { indexaCentrePerNom, normalitzaNomRestaurant } from "@/lib/cost-salarial/restaurant-noms";
import { db } from "@/lib/db";
import {
  type TipusFitxerVendes,
  codiCentreDesDeSufix,
  metaDesDelNomFitxer,
  parseVendesArticlesBuffer,
  parseVendesDiariesBuffer,
} from "@/lib/excel-parsers/vendes-restaurants";
import {
  CENTRE_CODI_TICKETS_PAGAMENT,
  esFormatVendesTicketsPagament,
  parseVendesTicketsPagamentBuffer,
} from "@/lib/excel-parsers/vendes-tickets-pagament";
import { MESOS_LLARGS } from "@/lib/periodes";
import { teTaxonomiaVendesArticle } from "@/lib/vendes-restaurants/prisma-fields";

const CODI_LN_RESTAURANTS = "LN00001";

export interface ImportVendesResult {
  ok: boolean;
  missatge: string;
  tipus: TipusFitxerVendes | null;
  centreCodi: string | null;
  periode: string | null;
  files: number;
  errors: string[];
  carregaId?: string;
}

async function carregaCentres() {
  const ln = await db.liniaNegoci.findUnique({
    where: { codi: CODI_LN_RESTAURANTS },
    select: {
      centres: {
        where: { isActive: true },
        select: { id: true, codi: true, nom: true },
      },
    },
  });
  const byCodi = new Map<string, { id: string; codi: string; nom: string }>();
  const byNom = new Map<string, { id: string; codi: string; nom: string }>();
  for (const c of ln?.centres ?? []) {
    byCodi.set(c.codi.toUpperCase(), c);
    indexaCentrePerNom(byNom, c);
  }
  return { byCodi, byNom };
}

async function resolPeriodId(any: number, mes: number): Promise<string> {
  const period = await db.period.upsert({
    where: { any_mes: { any, mes } },
    update: {},
    create: { any, mes, nom: `${MESOS_LLARGS[mes - 1]} ${any}` },
  });
  return period.id;
}

function resolCentre(
  byCodi: Map<string, { id: string; codi: string; nom: string }>,
  byNom: Map<string, { id: string; codi: string; nom: string }>,
  centreSufix: number | null,
  nomCentre: string | null
): { centre: { id: string; codi: string; nom: string } | null; errors: string[] } {
  const errors: string[] = [];
  let perCodi: { id: string; codi: string; nom: string } | null = null;
  let perNom: { id: string; codi: string; nom: string } | null = null;

  if (centreSufix != null) {
    const codi = codiCentreDesDeSufix(centreSufix);
    perCodi = byCodi.get(codi) ?? null;
    if (!perCodi) errors.push(`Centre ${codi} (sufix fitxer) no trobat a LN00001.`);
  }

  const nomSospitos =
    !nomCentre ||
    /^(article|articulo|centre|centro|jornada|unitats|base|cobrades|pack|detall)$/i.test(
      nomCentre.trim()
    );

  if (nomCentre && !nomSospitos) {
    const clau = normalitzaNomRestaurant(nomCentre);
    perNom = byNom.get(clau) ?? null;
    if (!perNom) {
      const alt = clau.replace(/\s+cal blay$/, "").trim();
      perNom = byNom.get(alt) ?? null;
    }
    if (!perNom && !perCodi) {
      errors.push(`Restaurant «${nomCentre}» no trobat als centres.`);
    }
  }

  if (perCodi && perNom && perCodi.id !== perNom.id) {
    errors.push(
      `Inconsistència: fitxer apunta a ${perCodi.codi} però el Centre del full és «${nomCentre}» (${perNom.codi}). Es fa servir el codi del fitxer.`
    );
    return { centre: perCodi, errors };
  }

  const centre = perCodi ?? perNom;
  if (!centre && !errors.length) {
    errors.push(
      "No s'ha pogut determinar el restaurant (cal sufix _NN al fitxer, ex. Detall_05_2028_04)."
    );
  }
  return { centre, errors };
}

function tipusCarrega(tipus: TipusFitxerVendes): TipusCarregaFitxer {
  if (tipus === "V") return "VENDES_V";
  if (tipus === "PACK") return "VENDES_PACK";
  return "VENDES_DETALL";
}

async function netejaCarreguesOrfes(carregaIds: string[]) {
  const ids = [...new Set(carregaIds.filter(Boolean))];
  for (const id of ids) {
    const c = await db.carregaFitxer.findUnique({
      where: { id },
      select: {
        _count: { select: { vendesDiaries: true, vendesArticles: true } },
      },
    });
    if (c && c._count.vendesDiaries === 0 && c._count.vendesArticles === 0) {
      await db.carregaFitxer.delete({ where: { id } }).catch(() => undefined);
    }
  }
}

async function importarTicketsFormaPagament(
  buffer: Buffer,
  nomFitxer: string,
  opts: { creatPer: string; mida?: number }
): Promise<ImportVendesResult> {
  const parsed = parseVendesTicketsPagamentBuffer(buffer);
  const errors = [...parsed.errors];
  for (const a of parsed.avisos) errors.push(a);

  if (!parsed.linies.length) {
    return {
      ok: false,
      missatge: "No s'ha pogut importar el fitxer de tickets (forma de pagament).",
      tipus: "V",
      centreCodi: CENTRE_CODI_TICKETS_PAGAMENT,
      periode: null,
      files: 0,
      errors,
    };
  }

  const { byCodi } = await carregaCentres();
  const centre = byCodi.get(CENTRE_CODI_TICKETS_PAGAMENT) ?? null;
  if (!centre) {
    return {
      ok: false,
      missatge: `Centre ${CENTRE_CODI_TICKETS_PAGAMENT} no trobat a LN00001.`,
      tipus: "V",
      centreCodi: CENTRE_CODI_TICKETS_PAGAMENT,
      periode: null,
      files: 0,
      errors,
    };
  }

  const periodes = new Map<string, { any: number; mes: number; periodId: string }>();
  for (const l of parsed.linies) {
    const key = `${l.any}-${l.mes}`;
    if (!periodes.has(key)) {
      const periodId = await resolPeriodId(l.any, l.mes);
      periodes.set(key, { any: l.any, mes: l.mes, periodId });
    }
  }

  const carregaIds: string[] = [];
  const prevCarregues: string[] = [];
  let totalFiles = 0;

  for (const { any, mes, periodId } of periodes.values()) {
    const liniesMes = parsed.linies.filter((l) => l.any === any && l.mes === mes);
    const periodeLabel = `${MESOS_LLARGS[mes - 1]} ${any}`;

    const carregaId = await crearCarregaFitxer({
      tipus: "VENDES_V",
      nomFitxer,
      mida: opts.mida ?? buffer.length,
      periodId,
      resum: `${centre.codi} · tickets · ${liniesMes.length} files · ${periodeLabel}`,
      creatPer: opts.creatPer,
    });
    carregaIds.push(carregaId);

    const prev = await db.vendaDiariaRestaurant.findMany({
      where: { periodId, centreId: centre.id },
      select: { carregaId: true },
    });
    for (const p of prev) {
      if (p.carregaId) prevCarregues.push(p.carregaId);
    }

    await db.$transaction(async (tx) => {
      await tx.vendaDiariaRestaurant.deleteMany({
        where: { periodId, centreId: centre.id },
      });
      if (liniesMes.length) {
        await tx.vendaDiariaRestaurant.createMany({
          data: liniesMes.map((l) => ({
            periodId,
            centreId: centre.id,
            carregaId,
            dia: l.dia,
            data: l.data,
            formaPagament: l.formaPagament,
            unitats: l.unitats,
            base: l.base,
          })),
        });
      }
    });

    totalFiles += liniesMes.length;
  }

  await netejaCarreguesOrfes(prevCarregues);

  const mesosLabel = [...periodes.values()]
    .sort((a, b) => a.any - b.any || a.mes - b.mes)
    .map((p) => `${MESOS_LLARGS[p.mes - 1]} ${p.any}`)
    .join(", ");

  return {
    ok: true,
    missatge: `${centre.codi}: ${totalFiles} files (dia × forma pagament) · base sense IVA 10% · ${mesosLabel}.`,
    tipus: "V",
    centreCodi: centre.codi,
    periode: mesosLabel,
    files: totalFiles,
    errors,
    carregaId: carregaIds[0],
  };
}

export async function importarVendesDesDeBuffer(
  buffer: Buffer,
  nomFitxer: string,
  opts: { creatPer: string; mida?: number }
): Promise<ImportVendesResult> {
  // Format tickets CCR00008 (Dia/Mes/Any/Total/Forma pagament) — detectat pel contingut
  if (esFormatVendesTicketsPagament(buffer)) {
    return importarTicketsFormaPagament(buffer, nomFitxer, opts);
  }

  const meta = metaDesDelNomFitxer(nomFitxer);
  if (!meta) {
    return {
      ok: false,
      missatge:
        "Nom de fitxer no reconegut. Usa V_MM_YYYY[_CC], Pack_MM_YYYY[_CC], Detall_MM_YYYY_CC, o un Excel de tickets (Dia/Mes/Any/Forma de pagament) per a CCR00008.",
      tipus: null,
      centreCodi: null,
      periode: null,
      files: 0,
      errors: [],
    };
  }

  const { byCodi, byNom } = await carregaCentres();
  if (!byCodi.size) {
    return {
      ok: false,
      missatge: "No s'han trobat centres de la LN Restaurants (LN00001).",
      tipus: meta.tipus,
      centreCodi: null,
      periode: `${MESOS_LLARGS[meta.mes - 1]} ${meta.any}`,
      files: 0,
      errors: [],
    };
  }

  const periodeLabel = `${MESOS_LLARGS[meta.mes - 1]} ${meta.any}`;
  const periodId = await resolPeriodId(meta.any, meta.mes);

  if (meta.tipus === "V") {
    const parsed = parseVendesDiariesBuffer(buffer, nomFitxer);
    const { centre, errors: centreErr } = resolCentre(
      byCodi,
      byNom,
      parsed.meta.centreSufix,
      parsed.nomCentre
    );
    const errors = [...parsed.errors, ...centreErr];
    if (!centre || !parsed.linies.length) {
      return {
        ok: false,
        missatge: "No s'ha pogut importar el fitxer de vendes diàries.",
        tipus: "V",
        centreCodi: centre?.codi ?? null,
        periode: periodeLabel,
        files: 0,
        errors,
      };
    }

    const carregaId = await crearCarregaFitxer({
      tipus: tipusCarrega("V"),
      nomFitxer,
      mida: opts.mida ?? buffer.length,
      periodId,
      resum: `${centre.codi} · ${parsed.linies.length} dies · ${periodeLabel}`,
      creatPer: opts.creatPer,
    });

    const prev = await db.vendaDiariaRestaurant.findMany({
      where: { periodId, centreId: centre.id },
      select: { carregaId: true },
    });

    await db.$transaction(async (tx) => {
      await tx.vendaDiariaRestaurant.deleteMany({
        where: { periodId, centreId: centre.id },
      });
      if (parsed.linies.length) {
        await tx.vendaDiariaRestaurant.createMany({
          data: parsed.linies.map((l) => ({
            periodId,
            centreId: centre.id,
            carregaId,
            dia: l.dia,
            data: l.data,
            unitats: l.unitats,
            base: l.base,
            formaPagament: "",
          })),
        });
      }
    });

    await netejaCarreguesOrfes(prev.map((p) => p.carregaId).filter(Boolean) as string[]);

    return {
      ok: true,
      missatge: `${centre.codi}: ${parsed.linies.length} dies importats (${periodeLabel}).`,
      tipus: "V",
      centreCodi: centre.codi,
      periode: periodeLabel,
      files: parsed.linies.length,
      errors,
      carregaId,
    };
  }

  // DETALL | PACK
  const parsed = parseVendesArticlesBuffer(buffer, nomFitxer);
  const origen = meta.tipus === "PACK" ? "PACK" : "DETALL";
  const { centre, errors: centreErr } = resolCentre(
    byCodi,
    byNom,
    parsed.meta.centreSufix,
    parsed.nomCentre
  );
  const errors = [...parsed.errors, ...centreErr];
  if (!centre || !parsed.linies.length) {
    return {
      ok: false,
      missatge: `No s'ha pogut importar el fitxer ${meta.tipus}.`,
      tipus: meta.tipus,
      centreCodi: centre?.codi ?? null,
      periode: periodeLabel,
      files: 0,
      errors,
    };
  }

  const carregaId = await crearCarregaFitxer({
    tipus: tipusCarrega(meta.tipus),
    nomFitxer,
    mida: opts.mida ?? buffer.length,
    periodId,
    resum: `${centre.codi} · ${parsed.linies.length} línies · ${periodeLabel}`,
    creatPer: opts.creatPer,
  });

  const prev = await db.vendaArticleRestaurant.findMany({
    where: { periodId, centreId: centre.id, origen },
    select: { carregaId: true },
  });

  await db.$transaction(async (tx) => {
    await tx.vendaArticleRestaurant.deleteMany({
      where: { periodId, centreId: centre.id, origen },
    });
    if (parsed.linies.length) {
      const ambTaxonomia = teTaxonomiaVendesArticle();
      await tx.vendaArticleRestaurant.createMany({
        data: parsed.linies.map((l) => {
          const row: Record<string, unknown> = {
            periodId,
            centreId: centre.id,
            carregaId,
            origen,
            article: l.article,
            tipusArticle: l.tipusArticle,
            unitats: l.unitats,
            base: l.base,
          };
          if (ambTaxonomia) {
            row.grup = l.grup;
            row.familia = l.familia;
            row.subfamilia = l.subfamilia;
            row.categoria = l.categoria;
          }
          return row;
        }) as never,
      });
    }
  });

  await netejaCarreguesOrfes(prev.map((p) => p.carregaId).filter(Boolean) as string[]);

  const etiqueta = origen === "PACK" ? "packs/menús" : "productes";
  return {
    ok: true,
    missatge: `${centre.codi}: ${parsed.linies.length} ${etiqueta} importats (${periodeLabel}).`,
    tipus: meta.tipus,
    centreCodi: centre.codi,
    periode: periodeLabel,
    files: parsed.linies.length,
    errors,
    carregaId,
  };
}
