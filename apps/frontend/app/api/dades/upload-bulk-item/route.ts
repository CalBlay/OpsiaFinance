import { auth } from "@/lib/auth";
import { handleBulkFileItem } from "@/lib/import-upload";
import type { TipusInforme } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Puja i processa UN fitxer dins una càrrega massiva. El client crida aquest endpoint en bucle. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ ok: false, missatge: "No autenticat." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const tipusEnum = formData.get("formatInformeId") as TipusInforme | null;
    const politica = (formData.get("politica") as string) || "versio";
    const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;
    const liniaNegociId = ((formData.get("liniaNegociId") as string | null) ?? "").trim() || null;
    const autoConfirmar = formData.get("autoConfirmar") !== "false";

    if (!file || file.size === 0) {
      return Response.json({ nom: "?", periode: "—", ok: false, missatge: "Fitxer buit." });
    }
    if (!tipusEnum) {
      return Response.json({
        nom: file.name,
        periode: "—",
        ok: false,
        missatge: "Tipus d'informe no indicat.",
      });
    }

    const result = await handleBulkFileItem(
      file,
      session.user.id,
      tipusEnum,
      politica,
      notes,
      liniaNegociId,
      autoConfirmar
    );
    return Response.json(result);
  } catch (err) {
    console.error("POST /api/dades/upload-bulk-item:", err);
    return Response.json(
      { nom: "?", periode: "—", ok: false, missatge: "Error inesperat al servidor." },
      { status: 500 }
    );
  }
}
