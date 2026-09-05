import type { KpiComite } from "@/components/consultes/PresentacioComite";
import type { KpiInformeItem } from "@/lib/kpi-definitions";
import { NODE_EBITDA, NODE_INGRESSOS } from "@/lib/kpi-definitions";
import { type NaturaConcepte, fraccioFix, fraccioVariable } from "@/lib/natura-concepte";

export type NaturaNodeMeta = {
  natura: NaturaConcepte | null;
  pctVariable: number | null;
};

/** Mapa node → natura (serialitzable per props / actions). */
export type NaturaByNodeRecord = Record<string, NaturaNodeMeta>;

export type ConceptePeInput = {
  node: number;
  total: number;
  esSubtotal?: boolean;
};

export type PuntEquilibriResult = {
  ingressos: number;
  variables: number;
  fixos: number;
  margeContribucio: number;
  /** MC / Ingressos × 100. */
  margeContribucioPct: number | null;
  /** PE en € d'ingressos. Null si no es pot calcular. */
  pe: number | null;
  /** Ingressos / PE. */
  cobertura: number | null;
};

/**
 * Fulles que NO entren a l'EBITDA (node 32 = 12+31).
 * Tot el que va després (financer, excepcional, amortitzacions, impost) queda fora del PE.
 * Excepció: node 44 (ETT) té número &gt; 32 però forma part del cost salarial / EBITDA.
 */
export function esNodeForaEbitdaPe(node: number): boolean {
  if (node === 44) return false;
  return node > NODE_EBITDA;
}

/** @deprecated Preferiu esNodeForaEbitdaPe — es manté per compatibilitat. */
export const NODES_DETALL_FORA_EBITDA = new Set<number>([33, 34, 36, 37, 39, 41]);

export function naturaRecordToMap(record: NaturaByNodeRecord): Map<number, NaturaNodeMeta> {
  const map = new Map<number, NaturaNodeMeta>();
  for (const [key, meta] of Object.entries(record)) {
    map.set(Number(key), meta);
  }
  return map;
}

/**
 * Meta de cost per al PE coherent amb l'EBITDA oficial.
 * - Fora d'EBITDA (financer, amortitzacions, …) → exclòs
 * - INGRES → exclòs
 * - ALIE dins d'EBITDA (p.ex. 29 Moviments interns) → FIX
 * - Sense natura → FIX (no perdre € de l'EBITDA)
 */
function metaCostPe(map: Map<number, NaturaNodeMeta>, node: number): NaturaNodeMeta | null {
  if (esNodeForaEbitdaPe(node)) return null;
  const meta = map.get(node);
  const natura = meta?.natura ?? null;
  if (natura === "INGRES") return null;
  if (natura === "ALIE") {
    return { natura: "FIX", pctVariable: null };
  }
  if (!natura) {
    return { natura: "FIX", pctVariable: null };
  }
  return { natura, pctVariable: meta?.pctVariable ?? null };
}

/**
 * Punt d'equilibri (PE) en € d'ingressos del període.
 *
 * Només costos que entren a l'EBITDA (mateixa base que el compte oficial):
 * Variables = despesa VARIABLE + MIXTE × (%var/100)
 * Fixos     = despesa FIX + MIXTE × (1 − %var/100) + ALIE-dins-EBITDA
 * MC        = Ingressos (node 6) − Variables
 * PE (€)    = Fixos ÷ (MC / Ingressos)
 *
 * Despesa = −import (costos negatius al compte). Identitat:
 * Ingressos − Variables − Fixos ≈ EBITDA ⇒ Ingressos &lt; PE ⟺ EBITDA &lt; 0.
 */
export function calcularPuntEquilibri(
  concepts: ConceptePeInput[],
  naturaByNode: Map<number, NaturaNodeMeta> | NaturaByNodeRecord
): PuntEquilibriResult {
  const map = naturaByNode instanceof Map ? naturaByNode : naturaRecordToMap(naturaByNode);

  const ingressos = concepts.find((c) => c.node === NODE_INGRESSOS)?.total ?? 0;

  let variables = 0;
  let fixos = 0;

  for (const c of concepts) {
    if (c.esSubtotal) continue;
    if (c.node === NODE_INGRESSOS || c.node === NODE_EBITDA) continue;
    const meta = metaCostPe(map, c.node);
    if (!meta?.natura) continue;

    // Costos negatius al compte; abonaments redueixen V/F (coherent amb EBITDA).
    const despesa = -c.total;
    variables += despesa * fraccioVariable(meta.natura, meta.pctVariable);
    fixos += despesa * fraccioFix(meta.natura, meta.pctVariable);
  }

  // Sense clamp: V+F ha de poder coincidir amb Ingressos−EBITDA (crèdits inclosos).
  const margeContribucio = ingressos - variables;
  const margeContribucioPct = ingressos > 0 ? (margeContribucio / ingressos) * 100 : null;

  const pe =
    ingressos > 0 && margeContribucio > 0 && fixos > 0
      ? fixos / (margeContribucio / ingressos)
      : null;
  const cobertura = pe != null && pe > 0 ? ingressos / pe : null;

  return {
    ingressos,
    variables,
    fixos,
    margeContribucio,
    margeContribucioPct,
    pe,
    cobertura,
  };
}

/**
 * Capes per al PE d'una LN.
 * - Compte de referència: Gestió (si hi és) = mateix compte que l'EBITDA.
 * - Traspassos d'hores (Δ Traspassos−Directe): es forcen a variable.
 * - Estructura Central: s'informa a part (import imputat des de Central, sense
 *   restar moviments interns tipus Admin→Green Vita).
 */
export type CapesPeLnInput = {
  directe: ConceptePeInput[];
  ambTraspassos?: ConceptePeInput[];
  gestio?: ConceptePeInput[];
  /**
   * Imputació Central al període (€ abs). Si s'informa, substitueix el Δ Gestió−Traspassos
   * (que barrejava sortides internes de la LN).
   */
  estructuraCentralImputada?: number;
};

export type PuntEquilibriPropiLnResult = PuntEquilibriResult & {
  /** |Δ personal traspass hores| forçat a variable. */
  traspassosVariables: number;
  /** Imputació Central al període (KPI; no cal que coincideixi amb Δ net Gestió). */
  estructuraCentral: number;
  estructuraCentralVariable: number;
  estructuraCentralFix: number;
  fixosPropis: number;
};

function indexPeByNode(concepts: ConceptePeInput[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const c of concepts) m.set(c.node, c.total);
  return m;
}

type DeltaCostSplit = { total: number; variables: number; fixos: number };

/**
 * Descomposa |delta| entre dues capes segons la natura de cada fulla.
 * Si `forcarVariable`, tot el |delta| va a variables (traspassos d'hores).
 */
function sumaAbsDeltaCostSplit(
  a: ConceptePeInput[],
  b: ConceptePeInput[],
  map: Map<number, NaturaNodeMeta>,
  opts?: { forcarVariable?: boolean }
): DeltaCostSplit {
  const byB = indexPeByNode(b);
  const byASub = new Map(a.map((c) => [c.node, c.esSubtotal]));
  const byBSub = new Map(b.map((c) => [c.node, c.esSubtotal]));
  const nodes = new Set<number>([...a.map((c) => c.node), ...b.map((c) => c.node)]);
  let total = 0;
  let variables = 0;
  let fixos = 0;
  for (const node of nodes) {
    const esSub = byASub.get(node) ?? byBSub.get(node);
    if (esSub) continue;
    const meta = metaCostPe(map, node);
    if (!meta?.natura) continue;
    const aTotal = a.find((c) => c.node === node)?.total ?? 0;
    const bTotal = byB.get(node) ?? 0;
    const abs = Math.abs(aTotal - bTotal);
    if (abs < 1e-9) continue;
    total += abs;
    if (opts?.forcarVariable) {
      variables += abs;
    } else {
      variables += abs * fraccioVariable(meta.natura, meta.pctVariable);
      fixos += abs * fraccioFix(meta.natura, meta.pctVariable);
    }
  }
  return { total, variables, fixos };
}

/**
 * PE LN coherent amb l'EBITDA del compte de referència.
 * - Amb Gestió: PE clàssic sobre Gestió (mateixa base que l'EBITDA Gestió).
 * - Sense Gestió: compte Traspassos/Directe + hores (Δ) forçades a variable.
 * - Estructura Central: KPI informatiu (imputació), no es torna a sumar al PE.
 */
export function calcularPuntEquilibriPropiLn(
  capes: CapesPeLnInput,
  naturaByNode: Map<number, NaturaNodeMeta> | NaturaByNodeRecord
): PuntEquilibriPropiLnResult {
  const map = naturaByNode instanceof Map ? naturaByNode : naturaRecordToMap(naturaByNode);
  const directe = capes.directe;
  const ambTraspassos = capes.ambTraspassos ?? directe;

  const estructuraCentral =
    capes.estructuraCentralImputada != null
      ? Math.abs(capes.estructuraCentralImputada)
      : capes.gestio
        ? sumaAbsDeltaCostSplit(capes.gestio, ambTraspassos, map).total
        : 0;

  // Gestió: PE = fórmula clàssica sobre el mateix compte que l'EBITDA.
  if (capes.gestio) {
    const base = calcularPuntEquilibri(capes.gestio, map);
    return {
      ...base,
      fixosPropis: base.fixos,
      traspassosVariables: 0,
      estructuraCentral,
      estructuraCentralVariable: 0,
      estructuraCentralFix: estructuraCentral,
    };
  }

  // Sense Gestió: Traspassos/Directe + hores a variable.
  const base = calcularPuntEquilibri(ambTraspassos, map);
  const traspass = sumaAbsDeltaCostSplit(ambTraspassos, directe, map, { forcarVariable: true });
  const traspassAVariable = Math.min(traspass.variables, base.fixos);
  const variables = base.variables + traspassAVariable;
  const fixos = Math.max(0, base.fixos - traspassAVariable);
  const ingressos = base.ingressos;
  const margeContribucio = ingressos - variables;
  const margeContribucioPct = ingressos > 0 ? (margeContribucio / ingressos) * 100 : null;
  const pe =
    ingressos > 0 && margeContribucio > 0 && fixos > 0
      ? fixos / (margeContribucio / ingressos)
      : null;
  const cobertura = pe != null && pe > 0 ? ingressos / pe : null;

  return {
    ingressos,
    variables,
    fixos,
    fixosPropis: fixos,
    margeContribucio,
    margeContribucioPct,
    pe,
    cobertura,
    traspassosVariables: traspassAVariable,
    estructuraCentral,
    estructuraCentralVariable: 0,
    estructuraCentralFix: estructuraCentral,
  };
}

export type ConceptePeMensualInput = {
  node: number;
  valors: number[];
  esSubtotal?: boolean;
};

export type CapesPeLnMensualInput = {
  directe: ConceptePeMensualInput[];
  ambTraspassos?: ConceptePeMensualInput[];
  gestio?: ConceptePeMensualInput[];
};

function mesToPeInput(concepts: ConceptePeMensualInput[], mesIdx: number): ConceptePeInput[] {
  return concepts.map((c) => ({
    node: c.node,
    total: c.valors[mesIdx] ?? 0,
    esSubtotal: c.esSubtotal,
  }));
}

function sumConceptsToPeriod(concepts: ConceptePeMensualInput[]): ConceptePeInput[] {
  return concepts.map((c) => ({
    node: c.node,
    total: c.valors.reduce((a, b) => a + b, 0),
    esSubtotal: c.esSubtotal,
  }));
}

/** MC / Ingressos (0–1). Null si no és usable. */
function mcRatio(r: PuntEquilibriResult): number | null {
  if (r.ingressos > 0 && r.margeContribucio > 0) return r.margeContribucio / r.ingressos;
  return null;
}

/**
 * PE_mes = Fixos_mes ÷ max(MC%_mes, MC%_període).
 *
 * - MC%_mes: garanteix que si EBITDA_mes &gt; 0 ⇒ PE_mes ≤ Ingressos_mes
 *   (amb V+F = costos fins a EBITDA).
 * - MC%_període: suavitza mesos febles (estacionalitat) sense disparar el PE.
 * - Només costos fins a EBITDA (financer / amortitzacions fora).
 */
function peMensualDesDeFixos(mes: PuntEquilibriResult, rPeriod: number | null): number | null {
  if (!(mes.ingressos > 0) || !(mes.fixos > 0)) return null;
  const rMes = mcRatio(mes);
  const r = rMes != null && rPeriod != null ? Math.max(rMes, rPeriod) : (rMes ?? rPeriod);
  if (r == null || !(r > 0)) return null;
  return mes.fixos / r;
}

/**
 * PE mensual LN:
 *   PE_mes = Fixos_mes ÷ max(MC%_mes, MC%_període)
 *
 * Base Gestió (o Traspassos/Directe). Abast = fins a EBITDA.
 */
export function calcularPePropiLnPerMes(
  capes: CapesPeLnMensualInput,
  naturaByNode: Map<number, NaturaNodeMeta> | NaturaByNodeRecord
): (number | null)[] {
  const len = Math.max(
    12,
    ...capes.directe.map((c) => c.valors.length),
    ...(capes.ambTraspassos?.map((c) => c.valors.length) ?? []),
    ...(capes.gestio?.map((c) => c.valors.length) ?? []),
    0
  );

  const period = calcularPuntEquilibriPropiLn(
    {
      directe: sumConceptsToPeriod(capes.directe),
      ambTraspassos: capes.ambTraspassos ? sumConceptsToPeriod(capes.ambTraspassos) : undefined,
      gestio: capes.gestio ? sumConceptsToPeriod(capes.gestio) : undefined,
    },
    naturaByNode
  );
  const rPeriod = mcRatio(period);

  const out: (number | null)[] = [];
  for (let i = 0; i < len; i++) {
    const mes = calcularPuntEquilibriPropiLn(
      {
        directe: mesToPeInput(capes.directe, i),
        ambTraspassos: capes.ambTraspassos ? mesToPeInput(capes.ambTraspassos, i) : undefined,
        gestio: capes.gestio ? mesToPeInput(capes.gestio, i) : undefined,
      },
      naturaByNode
    );
    out.push(peMensualDesDeFixos(mes, rPeriod));
  }
  return out;
}

/**
 * PE de cada mes = Fixos_mes ÷ max(MC%_mes, MC%_període).
 */
export function calcularPePerMes(
  concepts: ConceptePeMensualInput[],
  naturaByNode: Map<number, NaturaNodeMeta> | NaturaByNodeRecord
): (number | null)[] {
  const len = Math.max(12, ...concepts.map((c) => c.valors.length), 0);
  const rPeriod = mcRatio(calcularPuntEquilibri(sumConceptsToPeriod(concepts), naturaByNode));
  const out: (number | null)[] = [];
  for (let i = 0; i < len; i++) {
    const mes = calcularPuntEquilibri(mesToPeInput(concepts, i), naturaByNode);
    out.push(peMensualDesDeFixos(mes, rPeriod));
  }
  return out;
}

/** Mesos del rang amb ingressos ≠ 0 (mínim 1). */
export function nMesosAmbIngressos(ingressosMensuals: number[], desMes = 1, finsMes = 12): number {
  let n = 0;
  for (let m = desMes; m <= finsMes; m++) {
    if (Math.abs(ingressosMensuals[m - 1] ?? 0) > 0) n += 1;
  }
  return Math.max(n, 1);
}

/** PE mensual teòric = PE període ÷ n mesos amb activitat. */
export function peMensualTeoric(pePeriod: number, nMesos: number): number | null {
  if (!(pePeriod > 0) || !(nMesos > 0)) return null;
  return pePeriod / nMesos;
}

/**
 * Sèrie plana PE/n (referència mitjana). La gràfica LN usa calcularPePropiLnPerMes
 * (Fixos_mes ÷ MC%_període), no aquesta sèrie.
 */
export function seriePeMensualTeoric(
  pePeriod: number | null | undefined,
  nMesos: number,
  ingressosMensuals: number[]
): (number | null)[] {
  const peMes = pePeriod != null && pePeriod > 0 ? peMensualTeoric(pePeriod, nMesos) : null;
  return ingressosMensuals.map((ing) => (peMes != null && Math.abs(ing) > 0 ? peMes : null));
}

function formatFactor(n: number): string {
  return new Intl.NumberFormat("ca-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** KPIs d'informe: PE període + PE mensual (si nMesos>1) + Cobertura. */
export function kpisPuntEquilibri(
  concepts: ConceptePeInput[],
  naturaByNode: Map<number, NaturaNodeMeta> | NaturaByNodeRecord,
  opts?: { nMesos?: number }
): KpiInformeItem[] {
  const r = calcularPuntEquilibri(concepts, naturaByNode);
  if (r.pe == null || r.cobertura == null) return [];

  const items: KpiInformeItem[] = [
    {
      label: "PE",
      tipus: "pe",
      import_: r.pe,
      pctVendes: r.margeContribucioPct,
      nota: "PE del període",
    },
  ];

  const nMesos = opts?.nMesos ?? 1;
  const peMes = peMensualTeoric(r.pe, nMesos);
  if (nMesos > 1 && peMes != null) {
    items.push({
      label: "PE mensual",
      tipus: "pe",
      import_: peMes,
      pctVendes: r.margeContribucioPct,
      nota: "Vendes / mes per equilibri",
    });
  }

  items.push({
    label: "Cobertura",
    tipus: "cobertura",
    import_: r.cobertura,
    pctVendes: null,
  });

  return items;
}

/** KPI informatiu d'estructura Central imputada (independent del PE). */
export function kpiEstructuraCentralItem(
  estructuraCentral: number,
  ingressos: number
): KpiInformeItem | null {
  if (!(estructuraCentral > 0)) return null;
  return {
    label: "Estructura Central",
    tipus: "estructura",
    import_: estructuraCentral,
    pctVendes: ingressos > 0 ? (estructuraCentral / ingressos) * 100 : null,
    nota: "Repartiment Central (fixes + sobrant 02/03)",
  };
}

/** KPIs PE LN (Directe + traspass var + Central com a fix) + desglossament Central. */
export function kpisPuntEquilibriPropiLn(
  capes: CapesPeLnInput,
  naturaByNode: Map<number, NaturaNodeMeta> | NaturaByNodeRecord,
  opts?: { nMesos?: number }
): KpiInformeItem[] {
  const r = calcularPuntEquilibriPropiLn(capes, naturaByNode);
  const estructuraItem = kpiEstructuraCentralItem(r.estructuraCentral, r.ingressos);

  if (r.pe == null || r.cobertura == null) {
    return estructuraItem ? [estructuraItem] : [];
  }

  const items: KpiInformeItem[] = [
    {
      label: "PE",
      tipus: "pe",
      import_: r.pe,
      pctVendes: r.margeContribucioPct,
      nota: "Compte Gestió (coherent amb EBITDA)",
    },
  ];

  const nMesos = opts?.nMesos ?? 1;
  const peMes = peMensualTeoric(r.pe, nMesos);
  if (nMesos > 1 && peMes != null) {
    items.push({
      label: "PE mensual",
      tipus: "pe",
      import_: peMes,
      pctVendes: r.margeContribucioPct,
      nota: `PE període ÷ ${nMesos} mesos (ref. mitjana)`,
    });
  }

  items.push({
    label: "Cobertura",
    tipus: "cobertura",
    import_: r.cobertura,
    pctVendes: null,
    nota: "Ingressos / PE",
  });

  if (estructuraItem) items.push(estructuraItem);

  return items;
}

/** Mateixos indicadors per a la presentació Comitè. */
export function kpisComitePuntEquilibri(
  concepts: ConceptePeInput[],
  naturaByNode: Map<number, NaturaNodeMeta> | NaturaByNodeRecord,
  opts?: { nMesos?: number }
): KpiComite[] {
  const r = calcularPuntEquilibri(concepts, naturaByNode);
  if (r.pe == null || r.cobertura == null) return [];

  const items: KpiComite[] = [
    {
      label: "PE",
      import_: r.pe,
      pct: r.margeContribucioPct,
      pctHint: "MC s/ ingressos",
      hint: "PE del període",
      accent: "neutral",
    },
  ];

  const nMesos = opts?.nMesos ?? 1;
  const peMes = peMensualTeoric(r.pe, nMesos);
  if (nMesos > 1 && peMes != null) {
    items.push({
      label: "PE mensual",
      import_: peMes,
      pct: r.margeContribucioPct,
      pctHint: "MC s/ ingressos",
      hint: "Vendes / mes per equilibri",
      accent: "neutral",
    });
  }

  items.push({
    label: "Cobertura",
    valueText: `${formatFactor(r.cobertura)}×`,
    hint: "Ingressos / PE",
    accent: "neutral",
  });

  return items;
}

/** KPIs Comitè PE LN (amb Central com a fix assignat). */
export function kpisComitePuntEquilibriPropiLn(
  capes: CapesPeLnInput,
  naturaByNode: Map<number, NaturaNodeMeta> | NaturaByNodeRecord,
  opts?: { nMesos?: number }
): KpiComite[] {
  const r = calcularPuntEquilibriPropiLn(capes, naturaByNode);
  const estructuraItem = kpiEstructuraCentralItem(r.estructuraCentral, r.ingressos);

  if (r.pe == null || r.cobertura == null) {
    if (!estructuraItem) return [];
    return [
      {
        label: estructuraItem.label,
        import_: estructuraItem.import_,
        pct: estructuraItem.pctVendes,
        pctHint: "s/ ingressos",
        hint: estructuraItem.nota ?? "Repartiment Central",
        accent: "neutral",
      },
    ];
  }

  const items: KpiComite[] = [
    {
      label: "PE",
      import_: r.pe,
      pct: r.margeContribucioPct,
      pctHint: "MC s/ ingressos",
      hint: "Compte Gestió (coherent amb EBITDA)",
      accent: "neutral",
    },
  ];

  const nMesos = opts?.nMesos ?? 1;
  const peMes = peMensualTeoric(r.pe, nMesos);
  if (nMesos > 1 && peMes != null) {
    items.push({
      label: "PE mensual",
      import_: peMes,
      pct: r.margeContribucioPct,
      pctHint: "MC s/ ingressos",
      hint: `PE període ÷ ${nMesos} mesos (ref. mitjana)`,
      accent: "neutral",
    });
  }

  items.push({
    label: "Cobertura",
    valueText: `${formatFactor(r.cobertura)}×`,
    hint: "Ingressos / PE",
    accent: "neutral",
  });

  if (estructuraItem) {
    items.push({
      label: estructuraItem.label,
      import_: estructuraItem.import_,
      pct: estructuraItem.pctVendes,
      pctHint: "s/ ingressos",
      hint: estructuraItem.nota ?? "Repartiment Central",
      accent: "neutral",
    });
  }

  return items;
}
