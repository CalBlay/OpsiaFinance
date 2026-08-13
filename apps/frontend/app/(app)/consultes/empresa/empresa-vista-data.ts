import type { PivotColumn } from "@/components/consultes/PivotTable";
import type { KpiComite } from "@/components/consultes/PresentacioComite";
import type { buildKpisEmpresa } from "@/lib/kpi-definitions";
import type { InfoGestioConsulta } from "@/lib/repartiment/info-gestio";
import type { VistaCompte } from "@/lib/vista-compte";

/** Tipus de la vista empresa (segur per client; sense db / Prisma). */
export type EmpresaVistaData = {
  vista: VistaCompte;
  subtitle: string;
  periodePresentacio: string;
  tableCaption: string;
  chartTitle: string | undefined;
  kpisComite: KpiComite[];
  kpis: ReturnType<typeof buildKpisEmpresa>;
  columns: PivotColumn[];
  pivotRows: Array<{
    node: number;
    concepteId?: string;
    descripcio: string;
    esSubtotal: boolean;
    valors: number[];
    total: number;
  }>;
  totalLabel: string;
  chartCategories: string[];
  chartSeries: { name: string; type: "bar" | "line"; color: string; data: number[] }[];
  chartTickAngle: number | undefined;
  drilldownColMap: {
    [colKey: string]: {
      mes?: number;
      rang?: { des: number; fins: number };
      liniaNegociId?: string;
    };
  };
  lnIdsGrup: string[];
  mensual: {
    mesos: string[];
    ingressos: number[];
    ebitda: number[];
    personal: number[];
    compres: number[];
    gestio: number[];
  };
  perLn: {
    etiquetes: string[];
    ingressos: number[];
    ebitda: number[];
    personal: number[];
    compres: number[];
    gestio: number[];
  };
  buit: boolean;
  canEdit: boolean;
  exportSubtitle: string;
  infoGestio: InfoGestioConsulta | null;
};
