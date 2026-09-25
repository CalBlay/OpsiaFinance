import { auth } from "@/lib/auth";
import { handleBulkFileItem, handleSingleImport } from "@/lib/import-upload";
import { UPLOAD_CHUNK_BYTES, UPLOAD_FILE_MAX_BYTES } from "@/lib/upload-limits";
import { desarTros, eliminarPujada, llegirFitxerComplet } from "@/lib/upload-parts";
import type { TipusInforme } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const RESERVED = new Set(["chunk", "uploadId", "index", "total", "fileName", "fileSize", "kind"]);

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function errorJson(message: string, status = 400) {
  return Response.json({ status: "error", message, ok: false, missatge: message }, { status });
}

/** Rep un tros d'un Excel gran i, a l'últim, el processa com una pujada normal. */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorJson("No autenticat.", 401);

    const formData = await request.formData();
    const chunk = formData.get("chunk");
    if (!(chunk instanceof Blob) || chunk.size === 0) {
      return errorJson("Falta un tros del fitxer.");
    }
    if (chunk.size > UPLOAD_CHUNK_BYTES) {
      return errorJson("Un tros del fitxer supera el límit de pujada.");
    }

    const uploadId = text(formData, "uploadId");
    if (!/^[0-9a-f-]{36}$/i.test(uploadId)) {
      return errorJson("Identificador de pujada no vàlid.");
    }

    const index = Number(text(formData, "index"));
    const total = Number(text(formData, "total"));
    const fileSize = Number(text(formData, "fileSize"));
    const fileName = text(formData, "fileName").split(/[/\\]/).pop()?.trim() ?? "";
    const kind = text(formData, "kind");

    if (
      !Number.isInteger(index) ||
      !Number.isInteger(total) ||
      index < 0 ||
      total < 1 ||
      index >= total ||
      total > 40
    ) {
      return errorJson("La pujada està incompleta.");
    }
    if (!Number.isInteger(fileSize) || fileSize <= 0 || fileSize > UPLOAD_FILE_MAX_BYTES) {
      return errorJson("El fitxer supera el límit de 50 MB.");
    }
    if (!/\.(xlsx|xls)$/i.test(fileName)) {
      return errorJson("Només s'accepten fitxers Excel (.xlsx o .xls).");
    }
    if (kind !== "single" && kind !== "bulk") {
      return errorJson("Tipus de pujada no vàlid.");
    }

    await desarTros({
      uploadId,
      index,
      total,
      nom: fileName,
      contingut: Buffer.from(await chunk.arrayBuffer()),
    });

    if (index < total - 1) return Response.json({ status: "pending" });

    const buffer = await llegirFitxerComplet(uploadId, total);
    await eliminarPujada(uploadId);
    if (!buffer || buffer.length !== fileSize) {
      return errorJson("No s'han rebut tots els trossos del fitxer. Torna-ho a provar.");
    }

    const file = new File([new Uint8Array(buffer)], fileName);

    if (kind === "bulk") {
      const tipusEnum = text(formData, "formatInformeId") as TipusInforme;
      if (!tipusEnum) {
        return Response.json({
          nom: fileName,
          periode: "—",
          ok: false,
          confirmat: false,
          missatge: "Tipus d'informe no indicat.",
        });
      }
      const result = await handleBulkFileItem(
        file,
        session.user.id,
        tipusEnum,
        text(formData, "politica") || "versio",
        text(formData, "notes").trim() || null,
        text(formData, "liniaNegociId").trim() || null,
        text(formData, "autoConfirmar") !== "false"
      );
      return Response.json(result);
    }

    const fd = new FormData();
    fd.append("file", file);
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && !RESERVED.has(key)) fd.append(key, value);
    }
    const result = await handleSingleImport(fd, session.user.id);
    return Response.json(result);
  } catch (err) {
    console.error("POST /api/dades/upload-part:", err);
    return errorJson("Error inesperat en pujar el fitxer.", 500);
  }
}
