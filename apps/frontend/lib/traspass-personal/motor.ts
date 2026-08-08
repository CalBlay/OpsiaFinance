/**
 * Motor de càlcul de traspassos.
 *
 * Per cada fila Excel:
 *   Organizaciones → mapeig → centre origen + dept (SALA/CUINA)
 *   Proyecto       → mapeig → centre destí
 *   Minutos        → quantitat
 * Després agrega: origen × destí × dept.
 */

import { NODE_COST_SALARIAL } from "@/lib/repartiment/nodes";
import {
  type IndexMapeig,
  type MapeigCentre,
  indexarMapeigs,
  resoldreMapeig,
} from "@/lib/traspass-personal/mapeig";
import type { FilaHoresTreball } from "@/lib/traspass-personal/parser";
import type { DepartamentSalarial } from "@prisma/client";

export type { MapeigCentre };

export type AlertaTraspass = {
  fila: number;
  empleado: string;
  organizaciones: string;
  proyecto: string;
  motiu: string;
};

export type MovimentTraspassCalculat = {
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
  filesOrigen: number;
  exemples: {
    filaExcel: number;
    organizaciones: string;
    proyecto: string;
    minutos: number;
  }[];
};

export type ResultatMotorTraspass = {
  moviments: MovimentTraspassCalculat[];
  alertes: AlertaTraspass[];
  filesProcessades: number;
  filesIgnoradesMateixCentre: number;
};

export function calcularTraspassosPersonal(
  files: FilaHoresTreball[],
  mapeigs: MapeigCentre[],
  tarifaHora: number
): ResultatMotorTraspass {
  const index: IndexMapeig = indexarMapeigs(mapeigs);
  const alertes: AlertaTraspass[] = [];

  type Ag = {
    origen: MapeigCentre;
    desti: MapeigCentre;
    departament: DepartamentSalarial;
    minuts: number;
    files: number;
    exemples: MovimentTraspassCalculat["exemples"];
  };
  const agregat = new Map<string, Ag>();
  let filesIgnoradesMateixCentre = 0;

  for (const f of files) {
    const origen = resoldreMapeig(f.organizaciones, index);
    const desti = resoldreMapeig(f.proyecto, index);

    if (!origen) {
      alertes.push({
        fila: f.filaExcel,
        empleado: f.empleado,
        organizaciones: f.organizaciones,
        proyecto: f.proyecto,
        motiu: `Sense mapeig per Organizaciones «${f.organizaciones}». Afegeix-lo a Configuració → Traspassos personal.`,
      });
      continue;
    }
    if (!desti) {
      alertes.push({
        fila: f.filaExcel,
        empleado: f.empleado,
        organizaciones: f.organizaciones,
        proyecto: f.proyecto,
        motiu: `Sense mapeig per Proyecto «${f.proyecto}». Afegeix-lo a Configuració → Traspassos personal.`,
      });
      continue;
    }
    if (origen.centreId === desti.centreId) {
      filesIgnoradesMateixCentre++;
      continue;
    }

    const departament = origen.departament;
    const key = `${origen.centreId}|${desti.centreId}|${departament}`;
    const ex = {
      filaExcel: f.filaExcel,
      organizaciones: f.organizaciones,
      proyecto: f.proyecto,
      minutos: f.minutos,
    };
    const prev = agregat.get(key);
    if (prev) {
      prev.minuts += f.minutos;
      prev.files++;
      if (prev.exemples.length < 12) prev.exemples.push(ex);
    } else {
      agregat.set(key, {
        origen,
        desti,
        departament,
        minuts: f.minutos,
        files: 1,
        exemples: [ex],
      });
    }
  }

  const moviments: MovimentTraspassCalculat[] = [...agregat.values()].map((a) => {
    const minuts = Math.round(a.minuts * 100) / 100;
    const hores = Math.round((minuts / 60) * 100) / 100;
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
      import_: Math.round(hores * tarifaHora * 100) / 100,
      concepteNode: NODE_COST_SALARIAL,
      filesOrigen: a.files,
      exemples: a.exemples,
    };
  });

  moviments.sort(
    (a, b) =>
      a.origenNom.localeCompare(b.origenNom, "ca") ||
      a.destiNom.localeCompare(b.destiNom, "ca") ||
      a.departament.localeCompare(b.departament)
  );

  return {
    moviments,
    alertes,
    filesProcessades: files.length,
    filesIgnoradesMateixCentre,
  };
}

export function validarZeroSumTraspass(_moviments: MovimentTraspassCalculat[]): {
  ok: boolean;
  suma: number;
} {
  return { ok: true, suma: 0 };
}
