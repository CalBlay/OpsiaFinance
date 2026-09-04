"use server";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";

type Result = { ok: boolean; missatge: string };

const OK = (missatge = ""): Result => ({ ok: true, missatge });
const ERR = (missatge: string): Result => ({ ok: false, missatge });

async function requireEditor(): Promise<boolean> {
  const session = await auth();
  const role = session?.user?.role;
  return role === "ADMIN";
}

function refresh() {
  revalidatePath("/settings/dimensions");
}

/* ─── Importar Arbre de dimensions des de l'Excel ─────────────────────────────── */

const ARBRE_FILE = "Arbre de dimensions V030226.xlsx";

/** Resol la ruta del fitxer d'arbre: el servidor Next corre a apps/frontend,
 *  però el fitxer és a l'arrel del monorepo. Provem diverses ubicacions. */
function resolveArbrePath(): string | null {
  const cwd = process.cwd();
  const candidates = [
    join(cwd, ARBRE_FILE),
    join(cwd, "..", "..", ARBRE_FILE),
    join(cwd, "..", ARBRE_FILE),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

export async function importarArbreAction(): Promise<Result> {
  if (!(await requireEditor())) return ERR("No tens permisos per importar.");

  const filePath = resolveArbrePath();
  if (!filePath) {
    return ERR(
      `No s'ha trobat el fitxer '${ARBRE_FILE}'. Col·loca'l a l'arrel del projecte (C:\\dev\\OpsiaFinance).`
    );
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(readFileSync(filePath));
  } catch {
    return ERR(`No s'ha pogut llegir el fitxer '${ARBRE_FILE}'.`);
  }

  const sheet = workbook.Sheets.Dimensions;
  if (!sheet) return ERR("Full 'Dimensions' no trobat al fitxer.");

  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
  });

  let lnCount = 0;
  let centreCount = 0;
  let deptCount = 0;

  let currentLnId: string | null = null;
  let currentCentreId: string | null = null;
  let lnOrdre = 0;
  let centreOrdre = 0;
  let deptOrdre = 0;

  const cell = (row: (string | number | null)[], i: number): string | null => {
    const v = row?.[i];
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s.length ? s : null;
  };

  // Fila 1 = capçalera de fitxer, Fila 2 (índex 1) = "Dimensió 1/2/3" → comença a índex 2
  for (let i = 2; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row) continue;

    // Dimensió 1 — Línia de negoci (columna 0): "LN00001 RESTAURANTS"
    const lnRaw = cell(row, 0);
    if (lnRaw) {
      const sp = lnRaw.indexOf(" ");
      const codi = sp > 0 ? lnRaw.slice(0, sp) : lnRaw;
      const nom = sp > 0 ? lnRaw.slice(sp + 1).trim() : lnRaw;
      const ln = await db.liniaNegoci.upsert({
        where: { codi },
        update: { nom },
        create: { codi, nom, ordre: lnOrdre++ },
      });
      currentLnId = ln.id;
      currentCentreId = null;
      centreOrdre = 0;
      lnCount++;
    }

    // Dimensió 2 — Centre (columnes 2 codi, 3 nom)
    const centreCodi = cell(row, 2);
    const centreNom = cell(row, 3);
    if (centreCodi && currentLnId) {
      const centre = await db.centre.upsert({
        where: { liniaNegociId_codi: { liniaNegociId: currentLnId, codi: centreCodi } },
        update: { nom: centreNom ?? centreCodi },
        create: {
          codi: centreCodi,
          nom: centreNom ?? centreCodi,
          ordre: centreOrdre++,
          liniaNegociId: currentLnId,
        },
      });
      currentCentreId = centre.id;
      deptOrdre = 0;
      centreCount++;
    }

    // Dimensió 3 — Departament (columnes 4 codi, 5 nom)
    const deptCodi = cell(row, 4);
    const deptNom = cell(row, 5);
    if (deptCodi && currentCentreId) {
      await db.departament.upsert({
        where: { centreId_codi: { centreId: currentCentreId, codi: deptCodi } },
        update: { nom: deptNom ?? deptCodi },
        create: {
          codi: deptCodi,
          nom: deptNom ?? deptCodi,
          ordre: deptOrdre++,
          centreId: currentCentreId,
        },
      });
      deptCount++;
    }
  }

  refresh();
  return OK(
    `Importació completada: ${lnCount} línies de negoci, ${centreCount} centres i ${deptCount} departaments.`
  );
}

/* ─── Dimensió 1: Línia de Negoci ─────────────────────────────────────────────── */

export async function createLnAction(codi: string, nom: string): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  const c = codi.trim();
  const n = nom.trim();
  if (!c || !n) return ERR("Codi i nom són obligatoris.");
  const max = await db.liniaNegoci.aggregate({ _max: { ordre: true } });
  try {
    await db.liniaNegoci.create({
      data: { codi: c, nom: n, ordre: (max._max.ordre ?? -1) + 1 },
    });
  } catch {
    return ERR(`Ja existeix una línia de negoci amb el codi '${c}'.`);
  }
  refresh();
  return OK();
}

export async function updateLnAction(id: string, codi: string, nom: string): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  try {
    await db.liniaNegoci.update({
      where: { id },
      data: { codi: codi.trim(), nom: nom.trim() },
    });
  } catch {
    return ERR("No s'ha pogut desar (codi duplicat?).");
  }
  refresh();
  return OK();
}

export async function toggleLnAction(id: string, isActive: boolean): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  await db.liniaNegoci.update({ where: { id }, data: { isActive } });
  refresh();
  return OK();
}

export async function deleteLnAction(id: string): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  const rows = await db.importRow.count({ where: { liniaNegociId: id } });
  if (rows > 0)
    return ERR("No es pot eliminar: té dades importades associades. Desactiva-la millor.");
  await db.liniaNegoci.delete({ where: { id } });
  refresh();
  return OK();
}

/* ─── Dimensió 2: Centre ──────────────────────────────────────────────────────── */

export async function createCentreAction(
  liniaNegociId: string,
  codi: string,
  nom: string
): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  const c = codi.trim();
  const n = nom.trim();
  if (!c || !n) return ERR("Codi i nom són obligatoris.");
  const max = await db.centre.aggregate({
    where: { liniaNegociId },
    _max: { ordre: true },
  });
  try {
    await db.centre.create({
      data: { codi: c, nom: n, liniaNegociId, ordre: (max._max.ordre ?? -1) + 1 },
    });
  } catch {
    return ERR(`Ja existeix un centre amb el codi '${c}' en aquesta línia.`);
  }
  refresh();
  return OK();
}

export async function updateCentreAction(id: string, codi: string, nom: string): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  try {
    await db.centre.update({ where: { id }, data: { codi: codi.trim(), nom: nom.trim() } });
  } catch {
    return ERR("No s'ha pogut desar (codi duplicat?).");
  }
  refresh();
  return OK();
}

export async function moveCentreAction(id: string, liniaNegociId: string): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  try {
    await db.centre.update({ where: { id }, data: { liniaNegociId } });
  } catch {
    return ERR("No s'ha pogut moure (codi duplicat a la línia destí?).");
  }
  refresh();
  return OK();
}

export async function toggleCentreAction(id: string, isActive: boolean): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  await db.centre.update({ where: { id }, data: { isActive } });
  refresh();
  return OK();
}

export async function deleteCentreAction(id: string): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  const rows = await db.importRow.count({ where: { centreId: id } });
  if (rows > 0)
    return ERR("No es pot eliminar: té dades importades associades. Desactiva'l millor.");
  await db.centre.delete({ where: { id } });
  refresh();
  return OK();
}

/* ─── Dimensió 3: Departament ─────────────────────────────────────────────────── */

export async function createDepartamentAction(
  centreId: string,
  codi: string,
  nom: string
): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  const c = codi.trim();
  const n = nom.trim();
  if (!c || !n) return ERR("Codi i nom són obligatoris.");
  const max = await db.departament.aggregate({ where: { centreId }, _max: { ordre: true } });
  try {
    await db.departament.create({
      data: { codi: c, nom: n, centreId, ordre: (max._max.ordre ?? -1) + 1 },
    });
  } catch {
    return ERR(`Ja existeix un departament amb el codi '${c}' en aquest centre.`);
  }
  refresh();
  return OK();
}

export async function updateDepartamentAction(
  id: string,
  codi: string,
  nom: string
): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  try {
    await db.departament.update({ where: { id }, data: { codi: codi.trim(), nom: nom.trim() } });
  } catch {
    return ERR("No s'ha pogut desar (codi duplicat?).");
  }
  refresh();
  return OK();
}

export async function toggleDepartamentAction(id: string, isActive: boolean): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  await db.departament.update({ where: { id }, data: { isActive } });
  refresh();
  return OK();
}

export async function deleteDepartamentAction(id: string): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  const rows = await db.importRow.count({ where: { departamentId: id } });
  if (rows > 0)
    return ERR("No es pot eliminar: té dades importades associades. Desactiva'l millor.");
  await db.departament.delete({ where: { id } });
  refresh();
  return OK();
}
