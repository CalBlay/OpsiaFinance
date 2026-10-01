import { REPARTIMENT_CODI_UPDATED_AT } from "@/lib/repartiment/constants";

export type EstatConfiguracioRepartiment = {
  alDia: boolean;
  motiusPendents: string[];
};

export function estatConfiguracioRepartiment(input: {
  calculatAt: Date | null | undefined;
  ultimaNormaUpdatedAt: Date | null | undefined;
  ultimaConfigPersonalUpdatedAt: Date | null | undefined;
  teCostPersonal: boolean;
  /** Override opcional (tests); per defecte {@link REPARTIMENT_CODI_UPDATED_AT}. */
  codiUpdatedAt?: Date | null;
}): EstatConfiguracioRepartiment {
  const motiusPendents: string[] = [];
  const codiUpdatedAt = input.codiUpdatedAt ?? REPARTIMENT_CODI_UPDATED_AT;

  if (codiUpdatedAt && (!input.calculatAt || input.calculatAt < codiUpdatedAt)) {
    motiusPendents.push("regles de codi");
  }
  if (
    input.ultimaNormaUpdatedAt &&
    (!input.calculatAt || input.calculatAt < input.ultimaNormaUpdatedAt)
  ) {
    motiusPendents.push("regles generals");
  }
  if (
    input.teCostPersonal &&
    input.ultimaConfigPersonalUpdatedAt &&
    (!input.calculatAt || input.calculatAt < input.ultimaConfigPersonalUpdatedAt)
  ) {
    motiusPendents.push("configuració de personal");
  }

  return { alDia: motiusPendents.length === 0, motiusPendents };
}
