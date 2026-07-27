"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updateLiniaNegociImportAction(
  importId: string,
  liniaNegociId: string
): Promise<{ ok: boolean; missatge: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, missatge: "No autenticat." };
  if (!["ADMIN", "EDICIO"].includes(session.user.role ?? ""))
    return { ok: false, missatge: "Sense permís." };

  const ln = await db.liniaNegoci.findUnique({
    where: { id: liniaNegociId },
    select: { id: true, codi: true, nom: true },
  });
  if (!ln) return { ok: false, missatge: "La línia de negoci seleccionada no existeix." };

  const imp = await db.importacio.findUnique({
    where: { id: importId },
    select: { id: true, periodId: true, formatInformeId: true, liniaNegociId: true },
  });
  if (!imp) return { ok: false, missatge: "Importació no trobada." };

  if (imp.periodId && imp.formatInformeId) {
    const duplicat = await db.importacio.findFirst({
      where: {
        id: { not: importId },
        periodId: imp.periodId,
        liniaNegociId: ln.id,
        formatInformeId: imp.formatInformeId,
      },
      select: { nomFitxer: true },
    });
    if (duplicat) {
      return {
        ok: false,
        missatge: `Ja existeix una altra importació per aquest període i LN («${duplicat.nomFitxer}»).`,
      };
    }
  }

  await db.importacio.update({
    where: { id: importId },
    data: { liniaNegociId: ln.id },
  });

  revalidatePath(`/dades/${importId}`);
  revalidatePath("/dades");
  return { ok: true, missatge: `Línia de negoci assignada: ${ln.codi} · ${ln.nom}.` };
}
