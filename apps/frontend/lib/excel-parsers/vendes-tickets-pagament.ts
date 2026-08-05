/**
 * Parser Excel de tickets diaris (CCR00008 · Font de la Canya).
 *
 * Columnes:
 *   A Dia · B Mes · C Any · D Total (amb IVA 10%) · H Forma de pagament
 *
 * La base imponible (= vendes reals) és Total / 1,10. Propines s'ignoren.
 * S'agrega per (any, mes, dia, formaPagament).
 */

import { parseImportExcel } from "@/lib/excel-parsers/cost-salarial-restaurants";
import * as XLSX from "xlsx";

/** IVA inclòs al Total del fitxer. */
export const IVA_TICKETS_VENDES = 0.1;

/** Centre fix d'aquest format. */
export const CENTRE_CODI_TICKETS_PAGAMENT = "CCR00008";

export interface VendaTicketAgregat {
  any: number;
  mes: number;
  dia: number;
  data: Date;
  formaPagament: string;
  /** Nombre de tickets agregats. */
  unitats: number;
  /** Base imponible (sense IVA). */
  base: number;
  /** Suma dels totals amb IVA (referència). */
  totalAmbIva: number;
}

export interface ParseVendesTicketsResult {
  linies: VendaTicketAgregat[];
  errors: string[];
  avisos: string[];
}

const MES_NOMS: Record<string, number> = {
  enero: 1,
  gener: 1,
  febrero: 2,
  febrer: 2,
  marzo: 3,
  març: 3,
  marc: 3,
  abril: 4,
  mayo: 5,
  maig: 5,
  junio: 6,
  juny: 6,
  julio: 7,
  juliol: 7,
  agosto: 8,
  agost: 8,
  septiembre: 9,
  setembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  novembre: 11,
  diciembre: 12,
  desembre: 12,
};

function normalitza(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function mesDesDeCel(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && raw >= 1 && raw <= 12) return Math.trunc(raw);
  const n = Number(String(raw).trim());
  if (Number.isFinite(n) && n >= 1 && n <= 12) return Math.trunc(n);
  const key = normalitza(String(raw));
  if (MES_NOMS[key] !== undefined) return MES_NOMS[key];
  for (const [nom, mes] of Object.entries(MES_NOMS)) {
    if (key.startsWith(nom)) return mes;
  }
  return null;
}

function diaDesDeCel(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return null;
  const dia = Math.trunc(n);
  return dia >= 1 && dia <= 31 ? dia : null;
}

function anyDesDeCel(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return null;
  const any = Math.trunc(n);
  return any >= 2000 && any <= 2100 ? any : null;
}

function baseDesDeTotalAmbIva(totalAmbIva: number): number {
  if (totalAmbIva === 0) return 0;
  return Math.round((totalAmbIva / (1 + IVA_TICKETS_VENDES)) * 100) / 100;
}

function normalitzaFormaPagament(raw: unknown): string {
  const s = String(raw ?? "").trim();
  return s || "Altres";
}

interface CapcaleraTickets {
  rowIdx: number;
  colDia: number;
  colMes: number;
  colAny: number;
  colTotal: number;
  colForma: number;
}

function detectarCapcalera(rows: unknown[][]): CapcaleraTickets | null {
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i++) {
    const row = rows[i] ?? [];
    let colDia = -1;
    let colMes = -1;
    let colAny = -1;
    let colTotal = -1;
    let colForma = -1;

    for (let j = 0; j < row.length; j++) {
      const label = normalitza(String(row[j] ?? ""));
      if (!label) continue;
      if (colDia < 0 && (label === "dia" || label === "día")) colDia = j;
      else if (colMes < 0 && (label === "mes" || label === "month")) colMes = j;
      else if (
        colAny < 0 &&
        (label === "any" || label === "ano" || label === "año" || label === "year")
      )
        colAny = j;
      else if (
        colTotal < 0 &&
        (label === "total" ||
          label.startsWith("total ") ||
          label === "import" ||
          label === "importe")
      )
        colTotal = j;
      else if (
        colForma < 0 &&
        label.includes("forma") &&
        (label.includes("pagament") || label.includes("pago"))
      )
        colForma = j;
    }

    if (colDia >= 0 && colMes >= 0 && colAny >= 0 && colForma >= 0) {
      return {
        rowIdx: i,
        colDia,
        colMes,
        colAny,
        colTotal: colTotal >= 0 ? colTotal : 3, // D per defecte
        colForma,
      };
    }
  }
  return null;
}

/** True si el buffer sembla el format de tickets amb forma de pagament. */
export function esFormatVendesTicketsPagament(buffer: Buffer): boolean {
  try {
    const wb = XLSX.read(buffer, { cellDates: true, raw: true });
    const name = wb.SheetNames[0];
    if (!name) return false;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
      header: 1,
      defval: null,
      raw: true,
      blankrows: false,
    });
    return detectarCapcalera(rows) !== null;
  } catch {
    return false;
  }
}

export function parseVendesTicketsPagamentBuffer(buffer: Buffer): ParseVendesTicketsResult {
  const errors: string[] = [];
  const avisos: string[] = [];

  let rows: unknown[][];
  try {
    const wb = XLSX.read(buffer, { cellDates: true, raw: true });
    const name = wb.SheetNames[0];
    if (!name) return { linies: [], errors: ["El fitxer no té cap full."], avisos };
    rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
      header: 1,
      defval: null,
      raw: true,
      blankrows: false,
    });
  } catch (err) {
    return { linies: [], errors: [`No s'ha pogut llegir l'Excel: ${String(err)}`], avisos };
  }

  const cap = detectarCapcalera(rows);
  if (!cap) {
    return {
      linies: [],
      errors: [
        "No s'ha reconegut el format de tickets (cal capçalera Dia, Mes, Any i Forma de pagament).",
      ],
      avisos,
    };
  }

  type AgKey = string;
  const agregat = new Map<
    AgKey,
    {
      any: number;
      mes: number;
      dia: number;
      forma: string;
      tickets: number;
      total: number;
      base: number;
    }
  >();

  let filesLlegides = 0;
  let filesIgnorades = 0;

  for (let i = cap.rowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const dia = diaDesDeCel(row[cap.colDia]);
    const mes = mesDesDeCel(row[cap.colMes]);
    const any = anyDesDeCel(row[cap.colAny]);
    if (dia == null && mes == null && any == null) continue;

    if (dia == null || mes == null || any == null) {
      filesIgnorades++;
      continue;
    }

    const totalAmbIva = parseImportExcel(row[cap.colTotal]);
    if (totalAmbIva === 0) {
      filesIgnorades++;
      continue;
    }

    const forma = normalitzaFormaPagament(row[cap.colForma]);
    const baseTicket = baseDesDeTotalAmbIva(totalAmbIva);
    const key = `${any}|${mes}|${dia}|${forma}`;
    const prev = agregat.get(key);
    if (prev) {
      prev.tickets += 1;
      prev.total += totalAmbIva;
      prev.base += baseTicket;
    } else {
      agregat.set(key, {
        any,
        mes,
        dia,
        forma,
        tickets: 1,
        total: totalAmbIva,
        base: baseTicket,
      });
    }
    filesLlegides++;
  }

  if (filesLlegides === 0) {
    errors.push("No s'han trobat tickets amb import al fitxer.");
  }
  if (filesIgnorades > 0) {
    avisos.push(`${filesIgnorades} files ignorades (data incompleta o total 0).`);
  }

  const linies: VendaTicketAgregat[] = [...agregat.values()]
    .map((a) => ({
      any: a.any,
      mes: a.mes,
      dia: a.dia,
      data: new Date(Date.UTC(a.any, a.mes - 1, a.dia)),
      formaPagament: a.forma,
      unitats: a.tickets,
      base: Math.round(a.base * 100) / 100,
      totalAmbIva: Math.round(a.total * 100) / 100,
    }))
    .sort(
      (a, b) =>
        a.any - b.any ||
        a.mes - b.mes ||
        a.dia - b.dia ||
        a.formaPagament.localeCompare(b.formaPagament, "ca")
    );

  return { linies, errors, avisos };
}
