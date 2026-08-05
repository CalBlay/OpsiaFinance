import { FDLC_LN_CODI } from "@/lib/fdlc/constants";

/**
 * Àmbit d'empresa al selector global:
 * - calblay → només LN Cal Blay (sense FDLC)
 * - fdlc → només FDLC
 * - consolidat → totes les LN (Cal Blay + FDLC)
 */
export type GrupEmpresa = "calblay" | "fdlc" | "consolidat";

export const GRUP_EMPRESA_LABELS: Record<GrupEmpresa, string> = {
  calblay: "Cal Blay",
  fdlc: "FDLC",
  consolidat: "Consolidat",
};

/** Ordre fix al selector (no alfabètic). */
export const GRUP_EMPRESA_OPCIONS: GrupEmpresa[] = ["calblay", "fdlc", "consolidat"];

export const GRUP_EMPRESA_DEFAULT: GrupEmpresa = "calblay";

export function parseGrupEmpresa(raw: string | undefined | null): GrupEmpresa {
  if (raw === "fdlc") return "fdlc";
  if (raw === "consolidat") return "consolidat";
  return "calblay";
}

type LnMin = { id: string; codi: string; nom: string };

/** Filtra les LN que pertanyen a cada àmbit d'empresa. */
export function filtraLiniesPerGrup(linies: LnMin[], grup: GrupEmpresa): LnMin[] {
  if (grup === "fdlc") {
    return linies.filter((l) => l.codi === FDLC_LN_CODI);
  }
  if (grup === "consolidat") {
    return linies;
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

/** Gestió (repartiment) aplica a Cal Blay i al Consolidat (només LN Cal Blay; FDLC no es repart). */
export function grupPermetVistaGestio(grup: GrupEmpresa): boolean {
  return grup === "calblay" || grup === "consolidat";
}

/** Consolidació intra Cal Blay (consums/moviments interns). */
export function grupAplicaConsolidacioIntra(grup: GrupEmpresa): boolean {
  return grup === "calblay" || grup === "consolidat";
}

/** Pestanyes Resultats «Per línia» / «Per centre» no apliquen a FDLC (una sola LN sense centres). */
export function grupMostraConsultesLiniaCentre(grup: GrupEmpresa): boolean {
  return grup !== "fdlc";
}

/** A Restaurants, FDLC només veu el centre mirall CCR00008. */
export function grupFiltraRestaurantsNomesMirall(grup: GrupEmpresa): boolean {
  return grup === "fdlc";
}
