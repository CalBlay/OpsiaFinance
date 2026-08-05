import { GRUP_COOKIE_NAME } from "@/lib/grup-cookie-name";
import { GRUP_EMPRESA_DEFAULT, type GrupEmpresa, parseGrupEmpresa } from "@/lib/grups-empresa";
import { cookies } from "next/headers";

export { GRUP_COOKIE_NAME };
export { serializeGrupCookie } from "@/lib/grup-cookie-client";

/** Llegeix el grup d'empresa actiu des de la cookie (fallback Cal Blay). */
export async function getGrupEmpresaActual(): Promise<GrupEmpresa> {
  const jar = await cookies();
  const raw = jar.get(GRUP_COOKIE_NAME)?.value;
  if (!raw) return GRUP_EMPRESA_DEFAULT;
  return parseGrupEmpresa(raw);
}
