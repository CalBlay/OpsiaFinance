import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import styles from "@/components/consultes/report.module.css";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import { etiquetaVistaCompte, parseVistaCompte } from "@/lib/cost-salarial/compte";
import { quadreToExportInforme } from "@/lib/export/restaurants";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { grupFiltraRestaurantsNomesMirall } from "@/lib/grups-empresa";
import {
  getAnysQuadreRestaurants,
  getQuadreMandoRestaurants,
} from "@/lib/restaurants/quadre-mando";
import { QuadrePresentacio } from "./QuadrePresentacio";
import { QuadreSelectors } from "./QuadreSelectors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quadre de comandament restaurants — OpsiaFinance" };

export default async function QuadreMandoPage({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string; vista?: string }>;
}) {
  const sp = await searchParams;
  const grup = await getGrupEmpresaActual();
  const nomesMirall = grupFiltraRestaurantsNomesMirall(grup);
  const anysQuadre = await getAnysQuadreRestaurants();
  const anyCalendari = new Date().getFullYear();
  const anyActual = sp.any
    ? Number(sp.any)
    : anysQuadre.includes(anyCalendari)
      ? anyCalendari
      : (anysQuadre[0] ?? anyCalendari);
  const anys = anysQuadre.length ? anysQuadre : [anyActual];
  const mesRaw = sp.mes != null && sp.mes !== "" ? Number(sp.mes) : 0;
  const mes = Number.isFinite(mesRaw) && mesRaw >= 0 && mesRaw <= 12 ? mesRaw : 0;
  const vista = parseVistaCompte(sp.vista);

  const data = await getQuadreMandoRestaurants(anyActual, mes, nomesMirall, vista);
  const title = "Quadre de comandament · restaurants";
  const informe = data.buit ? null : quadreToExportInforme(data, { title });

  return (
    <div className={styles.page}>
      <ConsultaHeader
        title={title}
        subtitle={`Vista ${etiquetaVistaCompte(vista)} · Vendes TPV, personal (cost salarial), compres i EBITDA en una sola lectura. Objectiu cost operatiu ≤ 60%.`}
        actions={
          <>
            <QuadreSelectors anys={anys} any={anyActual} mes={mes} vista={vista} />
            <ExportInformeButton informe={informe} />
          </>
        }
      />

      {data.buit ? (
        <div className={styles.prompt}>
          <h3>Sense dades per {data.periode}</h3>
          <p>
            Calen vendes TPV i/o cost salarial i/o compte d&apos;explotació per centres de la LN
            restaurants. Puja fitxers a <a href="/dades/vendes-restaurants">Dades → Vendes</a> o{" "}
            <a href="/dades/cost-salarial">Cost salarial</a>.
          </p>
        </div>
      ) : (
        <QuadrePresentacio data={data} any={anyActual} mes={mes} vista={vista} />
      )}
    </div>
  );
}
