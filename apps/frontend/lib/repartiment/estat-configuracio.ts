export type EstatConfiguracioRepartiment = {
  alDia: boolean;
  motiusPendents: string[];
};

export function estatConfiguracioRepartiment(input: {
  calculatAt: Date | null | undefined;
  ultimaNormaUpdatedAt: Date | null | undefined;
  ultimaConfigPersonalUpdatedAt: Date | null | undefined;
  teCostPersonal: boolean;
}): EstatConfiguracioRepartiment {
  const motiusPendents: string[] = [];

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
