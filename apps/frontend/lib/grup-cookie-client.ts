import { GRUP_COOKIE_NAME } from "@/lib/grup-cookie-name";
import type { GrupEmpresa } from "@/lib/grups-empresa";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Valor de Set-Cookie / document.cookie per al grup d'empresa. */
export function serializeGrupCookie(grup: GrupEmpresa): string {
  return `${GRUP_COOKIE_NAME}=${grup}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}
