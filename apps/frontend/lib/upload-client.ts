import { UPLOAD_CHUNK_BYTES, UPLOAD_FILE_MAX_BYTES } from "@/lib/upload-limits";

export type UploadHttpResult = { ok: true; data: unknown } | { ok: false; message: string };

function missatgeHttp(status: number, data: unknown): string {
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    if (typeof rec.message === "string" && rec.message) return rec.message;
    if (typeof rec.missatge === "string" && rec.missatge) return rec.missatge;
  }
  if (status === 413) return "El fitxer supera el límit de pujada del servidor.";
  if (status === 401) return "La sessió ha caducat. Torna a entrar i repeteix la pujada.";
  return `El servidor ha respost amb un error (${status}).`;
}

async function llegirCos(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function interpretar(res: Response): Promise<UploadHttpResult> {
  const data = await llegirCos(res);
  if (!res.ok) return { ok: false, message: missatgeHttp(res.status, data) };
  if (data == null) {
    return { ok: false, message: "El servidor ha respost sense dades. Torna-ho a provar." };
  }
  return { ok: true, data };
}

/**
 * Puja un Excel. Els fitxers grans van a trossos: a Vercel el cos d'una funció
 * no pot passar de 4,5 MB i, si es supera, el navegador només veu un error de connexió.
 */
export async function postFitxerImport(
  endpoint: "/api/dades/upload" | "/api/dades/upload-bulk-item",
  file: File,
  fields: Record<string, string>
): Promise<UploadHttpResult> {
  if (file.size > UPLOAD_FILE_MAX_BYTES) {
    return { ok: false, message: "El fitxer supera el límit de 50 MB." };
  }

  if (file.size <= UPLOAD_CHUNK_BYTES) {
    const fd = new FormData();
    fd.append("file", file);
    for (const [key, value] of Object.entries(fields)) fd.append(key, value);
    return interpretar(await fetch(endpoint, { method: "POST", body: fd }));
  }

  const uploadId = crypto.randomUUID();
  const total = Math.ceil(file.size / UPLOAD_CHUNK_BYTES);
  const kind = endpoint === "/api/dades/upload-bulk-item" ? "bulk" : "single";

  for (let index = 0; index < total; index++) {
    const start = index * UPLOAD_CHUNK_BYTES;
    const chunk = file.slice(start, start + UPLOAD_CHUNK_BYTES);
    const fd = new FormData();
    fd.append("chunk", chunk, file.name);
    fd.append("uploadId", uploadId);
    fd.append("index", String(index));
    fd.append("total", String(total));
    fd.append("fileSize", String(file.size));
    fd.append("fileName", file.name);
    fd.append("kind", kind);
    if (index === total - 1) {
      for (const [key, value] of Object.entries(fields)) fd.append(key, value);
    }

    const resultat = await interpretar(
      await fetch("/api/dades/upload-part", { method: "POST", body: fd })
    );
    if (!resultat.ok) return resultat;

    const pendent =
      resultat.data != null &&
      typeof resultat.data === "object" &&
      (resultat.data as { status?: string }).status === "pending";

    if (index < total - 1) {
      if (!pendent) {
        return { ok: false, message: "La pujada s'ha interromput. Torna-ho a provar." };
      }
      continue;
    }

    if (pendent) {
      return { ok: false, message: "La pujada no s'ha completat. Torna-ho a provar." };
    }
    return resultat;
  }

  return { ok: false, message: "No s'ha pogut completar la pujada." };
}
