import dynamic from "next/dynamic";

/** Charts recharts: code-split fora del JS inicial de les pàgines RSC. */
export const IniciResumCharts = dynamic(
  () => import("@/components/consultes/IniciResumCharts").then((m) => m.IniciResumCharts),
  { ssr: false, loading: () => null }
);

export const EvolucioChart = dynamic(
  () => import("@/components/consultes/EvolucioChart").then((m) => m.EvolucioChart),
  { ssr: false, loading: () => null }
);

export const PresentacioComite = dynamic(
  () => import("@/components/consultes/PresentacioComite").then((m) => m.PresentacioComite),
  { ssr: false, loading: () => null }
);

export const VendesPieChart = dynamic(
  () => import("@/components/consultes/VendesPieChart").then((m) => m.VendesPieChart),
  { ssr: false, loading: () => null }
);
