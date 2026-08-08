import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  FileSpreadsheet,
  Scale,
  ShoppingBag,
  SlidersHorizontal,
  UserCog,
  Users,
} from "lucide-react";

export type DadesTabId =
  | "importacions"
  | "repartiment"
  | "traspass-personal"
  | "cost-personal-centre"
  | "cost-salarial"
  | "vendes-restaurants"
  | "ajustos";

export type DadesTab = {
  id: DadesTabId;
  href: string;
  label: string;
  /** Títol de la pàgina (capçalera del shell). */
  title: string;
  /** Descripció curta sota el títol. */
  description: string;
  icon: LucideIcon;
  /** True si el pathname pertany a aquesta pestanya. */
  match: (pathname: string) => boolean;
};

const OTHER_PREFIXES = [
  "/dades/repartiment",
  "/dades/traspass-personal",
  "/dades/cost-personal-centre",
  "/dades/cost-salarial",
  "/dades/vendes-restaurants",
  "/dades/ajustos",
] as const;

function isImportacionsPath(pathname: string): boolean {
  if (pathname !== "/dades" && !pathname.startsWith("/dades/")) return false;
  return !OTHER_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const DADES_TABS: DadesTab[] = [
  {
    id: "importacions",
    href: "/dades",
    label: "Importacions",
    title: "Importacions",
    description:
      "Informes Excel de resultats SAP. Puja, classifica i confirma les importacions periòdiques.",
    icon: FileSpreadsheet,
    match: isImportacionsPath,
  },
  {
    id: "repartiment",
    href: "/dades/repartiment",
    label: "Repartiment",
    title: "Repartiment mensual",
    description:
      "Calcula i confirma el repartiment de costos Central → LN per cada mes. Revisa abans de confirmar.",
    icon: Scale,
    match: (p) => p.startsWith("/dades/repartiment"),
  },
  {
    id: "traspass-personal",
    href: "/dades/traspass-personal",
    label: "Traspassos personal",
    title: "Traspassos de personal",
    description:
      "Importa l’Excel mensual d’hores amb el botó +. Nom del fitxer: «Hores Centres de Treball mm_aaaa.xlsx». Confirma els traspassos; s’apliquen a la vista Gestió (tractat).",
    icon: ArrowLeftRight,
    match: (p) => p.startsWith("/dades/traspass-personal"),
  },
  {
    id: "cost-personal-centre",
    href: "/dades/cost-personal-centre",
    label: "Cost personal",
    title: "Cost personal per centre",
    description:
      "Nòmina (Cost_Personal_mm_aa.xlsx) i millores (Cost_Personal_Millores_mm_aa.xlsx). J=brut, K=provisió, L=SS; Sous=J+K; Cost=J+K+L (M ignorada). Informatiu: no alimenta Gestió. Comparativa vs SAP directe (sense ajustos).",
    icon: UserCog,
    match: (p) => p.startsWith("/dades/cost-personal-centre"),
  },
  {
    id: "cost-salarial",
    href: "/dades/cost-salarial",
    label: "Cost salarial",
    title: "Cost salarial restaurants",
    description:
      "Font pròpia de cost salarial per restaurant (Sala / Cuina). Cada mes afegeix només les línies noves a l’Excel i puja amb el botó + (per defecte ignora el que ja hi ha). Opció d’actualitzar existents si cal corregir. Comparativa Fora centre vs traspassos d’hores.",
    icon: Users,
    match: (p) => p.startsWith("/dades/cost-salarial"),
  },
  {
    id: "vendes-restaurants",
    href: "/dades/vendes-restaurants",
    label: "Vendes rest.",
    title: "Vendes restaurants",
    description:
      "Vendes TPV per restaurant (LN00001). Amb el botó + pots pujar V/Detall/Pack, o tickets Dia/Mes/Any/Forma pagament (CCR00008, base = Total ÷ 1,10).",
    icon: ShoppingBag,
    match: (p) => p.startsWith("/dades/vendes-restaurants"),
  },
  {
    id: "ajustos",
    href: "/dades/ajustos",
    label: "Ajustos",
    title: "Ajustos",
    description: "Correccions manuals que se sumen a les dades SAP a les consultes.",
    icon: SlidersHorizontal,
    match: (p) => p.startsWith("/dades/ajustos"),
  },
];

export function getDadesTab(pathname: string): DadesTab | undefined {
  return DADES_TABS.find((t) => t.match(pathname));
}

export function getDadesTabById(id: DadesTabId): DadesTab {
  const tab = DADES_TABS.find((t) => t.id === id);
  if (!tab) throw new Error(`Pestanya de dades desconeguda: ${id}`);
  return tab;
}
