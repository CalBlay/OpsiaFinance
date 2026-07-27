import { FDLC_LN_CODI } from "@/lib/fdlc/constants";

/** Grup d'empresa al consolidat (Cal Blay ≠ FDLC). */
export type GrupEmpresa = "calblay" | "fdlc";

export const GRUP_EMPRESA_LABELS: Record<GrupEmpresa, string> = {
  calblay: "Cal Blay",
  fdlc: "FDLC",
};

export const GRUP_EMPRESA_DEFAULT: GrupEmpresa = "calblay";

export function parseGrupEmpresa(raw: string | undefined | null): GrupEmpresa {
  return raw === "fdlc" ? "fdlc" : "calblay";
}

type LnMin = { id: string; codi: string; nom: string };

/** Filtra les LN que pertanyen a cada grup d'empresa. */
export function filtraLiniesPerGrup(linies: LnMin[], grup: GrupEmpresa): LnMin[] {
  if (grup === "fdlc") {
    return linies.filter((l) => l.codi === FDLC_LN_CODI);
  }
  return linies.filter((l) => l.codi !== FDLC_LN_CODI);
}

export function etiquetaGrupEmpresa(grup: GrupEmpresa): string {
  return GRUP_EMPRESA_LABELS[grup];
}

export function esLiniaFdlc(codi: string): boolean {
  return codi === FDLC_LN_CODI;
}

/** LN que apareixen a consultes «per línia», «per centre», evolució LN, etc. (Cal Blay). */
export function exclouFdlcDeConsultaLinia<T extends LnMin>(linies: T[]): T[] {
  return linies.filter((l) => !esLiniaFdlc(l.codi));
}
