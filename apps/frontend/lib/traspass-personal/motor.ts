import { NODE_COST_SALARIAL } from "@/lib/repartiment/nodes";
import type { FilaHoresTreball } from "@/lib/traspass-personal/parser";
import type { DepartamentSalarial } from "@prisma/client";

export interface MapeigCentre {
  text: string;
  centreId: string;
  centreCodi: string;
  centreNom: string;
  /** Font de veritat des del mapeig persistit. */
  departament: DepartamentSalarial;
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
  departament: DepartamentSalarial;
  minuts: number;
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
    .replace(/^\d+\s+/, "")
    .replace(/\s+/g, " ");
}

function normalitzarClau(text: string): string {
  return normalitzarTextHores(text).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** «Events cuina central, Event» → «Events cuina central». */
function partPrincipal(text: string): string {
  const t = normalitzarTextHores(text);
  const idx = t.indexOf(",");
  return idx >= 0 ? t.slice(0, idx).trim() : t;
}

/**
 * Només match exacte (text sencer o part abans de la coma).
 * Sense endsWith/includes: eviten agregats inflats (Cuina Central → Admin, etc.).
 */
export function lookupMapeigCentre(
  text: string,
  map: Map<string, MapeigCentre>
): MapeigCentre | null {
  const t = text.trim();
  if (!t) return null;

  const candidats = [t, normalitzarTextHores(t), partPrincipal(t)];
  for (const c of candidats) {
    if (!c) continue;
    const hit = map.get(c) ?? map.get(normalitzarClau(c));
    if (hit) return hit;
  }
  return null;
}

function indexarMapeigs(mapeigs: MapeigCentre[]): Map<string, MapeigCentre> {
  const map = new Map<string, MapeigCentre>();
  for (const m of mapeigs) {
    const raw = m.text.trim();
    if (!raw) continue;
    // Indexa text complet i part principal (abans de coma), mai fragments curts de rol.
    const claus = new Set([raw, normalitzarTextHores(raw), normalitzarClau(raw)]);
    const principal = partPrincipal(raw);
    if (principal && principal.length >= 4) {
      claus.add(principal);
      claus.add(normalitzarClau(principal));
    }
    for (const k of claus) map.set(k, m);
  }
  return map;
}

export function calcularTraspassosPersonal(
  files: FilaHoresTreball[],
  mapeigs: MapeigCentre[],
  tarifaHora: number
): ResultatMotorTraspass {
  const map = indexarMapeigs(mapeigs);

  const alertes: AlertaTraspass[] = [];
  const agregat = new Map<
    string,
    {
      origen: MapeigCentre;
      desti: MapeigCentre;
      departament: DepartamentSalarial;
      minuts: number;
      files: number;
      exemples: { organizaciones: string; proyecto: string; minutos: number }[];
    }
  >();
  let filesIgnoradesMateixCentre = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const origen = lookupMapeigCentre(f.organizaciones, map);
    const desti = lookupMapeigCentre(f.proyecto, map);

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

    const departament = origen.departament;
    const key = `${origen.centreId}→${desti.centreId}|${departament}`;
    const prev = agregat.get(key);
    if (prev) {
      prev.minuts += f.minutos;
      prev.files++;
      if (prev.exemples.length < 5) {
        prev.exemples.push({
          organizaciones: f.organizaciones,
          proyecto: f.proyecto,
          minutos: f.minutos,
        });
      }
    } else {
      agregat.set(key, {
        origen,
        desti,
        departament,
        minuts: f.minutos,
        files: 1,
        exemples: [
          {
            organizaciones: f.organizaciones,
            proyecto: f.proyecto,
            minutos: f.minutos,
          },
        ],
      });
    }
  }

  const moviments: MovimentTraspassCalculat[] = [...agregat.values()].map((a) => {
    const minuts = Math.round(a.minuts * 100) / 100;
    const hores = Math.round((minuts / 60) * 100) / 100;
    const import_ = Math.round(hores * tarifaHora * 100) / 100;
    return {
      centreOrigenId: a.origen.centreId,
      centreDestiId: a.desti.centreId,
      origenCodi: a.origen.centreCodi,
      origenNom: a.origen.centreNom,
      destiCodi: a.desti.centreCodi,
      destiNom: a.desti.centreNom,
      departament: a.departament,
      minuts,
      hores,
      tarifaHora,
      import_,
      concepteNode: NODE_COST_SALARIAL,
    };
  });

  // Diagnòstic: si un agregat és molt gran, deixa exemples a alertes (per revisar mapeig).
  for (const a of agregat.values()) {
    if (a.minuts < 5000) continue;
    const ex = a.exemples
      .map((e) => `«${e.organizaciones}»→«${e.proyecto}» (${e.minutos} min)`)
      .join("; ");
    alertes.push({
      fila: 0,
      empleado: "—",
      organizaciones: a.origen.centreCodi,
      proyecto: a.desti.centreCodi,
      motiu: `Agregat gran (${a.files} files, ${Math.round(a.minuts)} min, ${a.departament}). Exemples: ${ex}`,
    });
  }

  moviments.sort(
    (a, b) =>
      a.origenNom.localeCompare(b.origenNom) ||
      a.destiNom.localeCompare(b.destiNom) ||
      a.departament.localeCompare(b.departament)
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
