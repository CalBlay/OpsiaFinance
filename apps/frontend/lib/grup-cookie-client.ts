import { GRUP_COOKIE_NAME } from "@/lib/grup-cookie-name";
import type { GrupEmpresa } from "@/lib/grups-empresa";
import { parseGrupEmpresa } from "@/lib/grups-empresa";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Event DOM per sincronitzar UI client (nav consultes, etc.) amb el selector. */
export const GRUP_CHANGE_EVENT = "opsia-grup-change";

/** Valor de Set-Cookie / document.cookie per al grup d'empresa. */
export function serializeGrupCookie(grup: GrupEmpresa): string {
  return `${GRUP_COOKIE_NAME}=${grup}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function readGrupCookieClient(): GrupEmpresa {
  if (typeof document === "undefined") return "calblay";
  const raw = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${GRUP_COOKIE_NAME}=`))
    ?.split("=")[1];
  return parseGrupEmpresa(raw);
}

/** Desa la cookie i notifica els listeners del mateix document. */
export function setGrupEmpresaClient(grup: GrupEmpresa): void {
  document.cookie = serializeGrupCookie(grup);
  window.dispatchEvent(new CustomEvent(GRUP_CHANGE_EVENT, { detail: grup }));
}
