import { db } from "@/lib/db";
import { parseExcelMapeigOrgPlantilla } from "@/lib/rrhh-plantilla/importar-mapeig";
import { normalitzarTextOrgPlantilla } from "@/lib/rrhh-plantilla/mapeig";

export type MapeigOrgPlantillaInput = {
  id?: string;
  text: string;
  liniaNegociId: string;
  centreId: string;
  departamentId: string | null;
};

export type MapeigOrgPlantillaListItem = {
  id: string;
  text: string;
  centre: {
    id: string;
    codi: string;
    nom: string;
    liniaNegociId: string;
    liniaNegoci: { id: string; codi: string; nom: string };
  };
  departament: { id: string; codi: string; nom: string } | null;
};

export async function llistaMapeigsOrgPlantilla(): Promise<MapeigOrgPlantillaListItem[]> {
  const rows = await db.mapeigOrgPlantilla.findMany({
    where: { isActive: true },
    orderBy: { text: "asc" },
    include: {
      centre: {
        select: {
          id: true,
          codi: true,
          nom: true,
          liniaNegociId: true,
          liniaNegoci: { select: { id: true, codi: true, nom: true } },
        },
      },
      departament: { select: { id: true, codi: true, nom: true } },
    },
  });
  return [...rows].sort((a, b) => a.text.localeCompare(b.text, "ca", { sensitivity: "base" }));
}

async function resoldreCentrePerCodi(
  codiCentre: string,
  nomCentre: string
): Promise<{ id: string } | null> {
  const codi = codiCentre.trim().toUpperCase();
  const centres = await db.centre.findMany({
    where: { codi, isActive: true },
    select: { id: true, nom: true },
  });
  if (!centres.length) return null;
  if (centres.length === 1) return centres[0] ?? null;
  const nom = nomCentre.trim().toLocaleLowerCase("ca");
  if (nom) {
    const hit = centres.find((c) => c.nom.toLocaleLowerCase("ca") === nom);
    if (hit) return hit;
  }
  return centres[0] ?? null;
}

export async function upsertMapeigOrgPlantilla(
  input: MapeigOrgPlantillaInput
): Promise<{ ok: true } | { ok: false; missatge: string }> {
  const text = normalitzarTextOrgPlantilla(input.text);
  if (!text) return { ok: false, missatge: "El text d'organització és obligatori." };
  if (!input.liniaNegociId) return { ok: false, missatge: "Selecciona una línia de negoci." };
  if (!input.centreId) return { ok: false, missatge: "Selecciona un centre." };

  const centre = await db.centre.findUnique({
    where: { id: input.centreId },
    select: { id: true, liniaNegociId: true, isActive: true },
  });
  if (!centre?.isActive) return { ok: false, missatge: "Centre no trobat." };
  if (centre.liniaNegociId !== input.liniaNegociId) {
    return { ok: false, missatge: "El centre no pertany a la línia seleccionada." };
  }

  const departamentId = input.departamentId?.trim() || null;
  if (departamentId) {
    const dept = await db.departament.findUnique({
      where: { id: departamentId },
      select: { id: true, centreId: true, isActive: true },
    });
    if (!dept?.isActive) {
      return { ok: false, missatge: "Departament no trobat a l'arbre de dimensions." };
    }
    if (dept.centreId !== input.centreId) {
      return { ok: false, missatge: "El departament no pertany al centre seleccionat." };
    }
  }

  try {
    if (input.id) {
      await db.mapeigOrgPlantilla.update({
        where: { id: input.id },
        data: { text, centreId: input.centreId, departamentId, isActive: true },
      });
      return { ok: true };
    }
    await db.mapeigOrgPlantilla.create({
      data: { text, centreId: input.centreId, departamentId },
    });
    return { ok: true };
  } catch {
    return {
      ok: false,
      missatge: input.id
        ? "No s'ha pogut actualitzar (text duplicat?)."
        : "Aquest text d'organització ja existeix.",
    };
  }
}

export async function deleteMapeigOrgPlantilla(id: string): Promise<void> {
  await db.mapeigOrgPlantilla.delete({ where: { id } });
}

export async function esborrarTotMapeigOrgPlantilla(): Promise<number> {
  const r = await db.mapeigOrgPlantilla.deleteMany({});
  return r.count;
}

export async function importarMapeigOrgPlantillaDesDeBuffer(
  buffer: Buffer,
  substituirTot = false
): Promise<{ importats: number; errors: string[] }> {
  const { files } = parseExcelMapeigOrgPlantilla(buffer);
  if (!files.length) {
    throw new Error("No s'han trobat files vàlides a l'excel de mapeig.");
  }

  if (substituirTot) {
    await db.mapeigOrgPlantilla.deleteMany({});
  }

  const errors: string[] = [];
  let importats = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f) continue;
    const centre = await resoldreCentrePerCodi(f.codiCentre, f.nomCentre);
    if (!centre) {
      errors.push(`Fila ${i + 1}: codi «${f.codiCentre}» no trobat a dimensions.`);
      continue;
    }

    let departamentId: string | null = null;
    if (f.codiDepartament) {
      const dept = await db.departament.findFirst({
        where: { centreId: centre.id, codi: f.codiDepartament, isActive: true },
        select: { id: true },
      });
      if (!dept) {
        errors.push(
          `Fila ${i + 1}: departament «${f.codiDepartament}» no trobat al centre ${f.codiCentre}.`
        );
        continue;
      }
      departamentId = dept.id;
    }

    await db.mapeigOrgPlantilla.upsert({
      where: { text: f.text },
      update: { centreId: centre.id, departamentId, isActive: true },
      create: { text: f.text, centreId: centre.id, departamentId, ordre: i },
    });
    importats++;
  }

  return { importats, errors };
}
