import { NODE_COST_SALARIAL } from "@/lib/repartiment/nodes";
import type { FilaHoresTreball } from "@/lib/traspass-personal/parser";

export interface MapeigCentre {
  text: string;
  centreId: string;
  centreCodi: string;
  centreNom: string;
}

export interface AlertaTraspass {
  fila: number;
  empleado: string;
  organizaciones: string;
  proyecto: string;
  motiu: string;
}

export interface MovimentTraspassCalculat {
  centreOrigenId: string;
  centreDestiId: string;
  origenCodi: string;
  origenNom: string;
  destiCodi: string;
  destiNom: string;
  hores: number;
  tarifaHora: number;
  import_: number;
  concepteNode: number;
}

export interface ResultatMotorTraspass {
  moviments: MovimentTraspassCalculat[];
  alertes: AlertaTraspass[];
  filesProcessades: number;
  filesIgnoradesMateixCentre: number;
}

function normalitzarTextHores(text: string): string {
  return text
    .trim()
    .replace(/^\d+\s+/, "") // prefix numèric de l'export (col. C)
    .replace(/\s+/g, " ");
}

function lookup(
  text: string,
  map: Map<string, MapeigCentre>,
  mapeigs: MapeigCentre[]
): MapeigCentre | null {
  const t = text.trim();
  const direct = map.get(t);
  if (direct) return direct;

  const sensePrefix = normalitzarTextHores(t);
  const perPrefix = map.get(sensePrefix);
  if (perPrefix) return perPrefix;

  const lower = sensePrefix.toLowerCase();
  for (const m of mapeigs) {
    const mk = m.text.trim().toLowerCase();
    if (mk === lower) return m;
    if (sensePrefix.endsWith(m.text) || m.text.endsWith(sensePrefix)) return m;
  }
  return null;
}

export function calcularTraspassosPersonal(
  files: FilaHoresTreball[],
  mapeigs: MapeigCentre[],
  tarifaHora: number
): ResultatMotorTraspass {
  const map = new Map<string, MapeigCentre>();
  for (const m of mapeigs) {
    map.set(m.text.trim(), m);
    map.set(normalitzarTextHores(m.text), m);
  }

  const alertes: AlertaTraspass[] = [];
  const agregat = new Map<string, { origen: MapeigCentre; desti: MapeigCentre; minuts: number }>();
  let filesIgnoradesMateixCentre = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const origen = lookup(f.organizaciones, map, mapeigs);
    const desti = lookup(f.proyecto, map, mapeigs);

    if (!origen) {
      alertes.push({
        fila: i + 1,
        empleado: f.empleado,
        organizaciones: f.organizaciones,
        proyecto: f.proyecto,
        motiu: "Text sense mapeig (Organizaciones)",
      });
      continue;
    }
    if (!desti) {
      alertes.push({
        fila: i + 1,
        empleado: f.empleado,
        organizaciones: f.organizaciones,
        proyecto: f.proyecto,
        motiu: "Text sense mapeig (Proyecto)",
      });
      continue;
    }
    if (origen.centreId === desti.centreId) {
      filesIgnoradesMateixCentre++;
      continue;
    }

    const key = `${origen.centreId}→${desti.centreId}`;
    const prev = agregat.get(key);
    if (prev) {
      prev.minuts += f.minutos;
    } else {
      agregat.set(key, { origen, desti, minuts: f.minutos });
    }
  }

  const moviments: MovimentTraspassCalculat[] = [...agregat.values()].map((a) => {
    const hores = Math.round((a.minuts / 60) * 100) / 100;
    const import_ = Math.round(hores * tarifaHora * 100) / 100;
    return {
      centreOrigenId: a.origen.centreId,
      centreDestiId: a.desti.centreId,
      origenCodi: a.origen.centreCodi,
      origenNom: a.origen.centreNom,
      destiCodi: a.desti.centreCodi,
      destiNom: a.desti.centreNom,
      hores,
      tarifaHora,
      import_,
      // Traspàs de cost salarial al node del compte (Personal = node 17).
      // Això evita que el KPI "Personal" quedi desalineat quan només es toca el detall.
      concepteNode: NODE_COST_SALARIAL,
    };
  });

  moviments.sort(
    (a, b) => a.origenNom.localeCompare(b.origenNom) || a.destiNom.localeCompare(b.destiNom)
  );

  return {
    moviments,
    alertes,
    filesProcessades: files.length,
    filesIgnoradesMateixCentre,
  };
}

/** Comprova que la suma de traspassos és zero (zero-sum). */
export function validarZeroSumTraspass(moviments: MovimentTraspassCalculat[]): {
  ok: boolean;
  suma: number;
} {
  let suma = 0;
  for (const m of moviments) {
    suma -= m.import_;
    suma += m.import_;
  }
  return { ok: Math.abs(suma) < 0.01, suma };
}
