import styles from "@/components/consultes/report.module.css";
import {
  getAnysVendesRestaurants,
  getCentresRestaurantsVendes,
  getComparativaVendes,
  getInformeVendesRestaurant,
} from "@/lib/vendes-restaurants/consultes";
import type { DetallVendes } from "./VendesPresentacio";
import { VendesComparativaPresentacio, VendesRestaurantPresentacio } from "./VendesPresentacio";
import boardStyles from "./VendesPresentacio.module.css";
import { VendesSelectors } from "./VendesSelectors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vendes restaurants — OpsiaFinance" };

const DETALLS_OK = new Set<string>([
  "restaurants",
  "evolucio",
  "calendari",
  "mix-prod",
  "prod-menjar-base",
  "prod-menjar-unitats",
  "prod-beguda-base",
  "prod-beguda-unitats",
  "prod-tots-base",
  "prod-tots-unitats",
  "fam-menjar-base",
  "fam-menjar-unitats",
  "fam-beguda-base",
  "fam-beguda-unitats",
  "fam-tots-base",
  "fam-tots-unitats",
  "subfam-menjar-base",
  "subfam-menjar-unitats",
  "subfam-beguda-base",
  "subfam-beguda-unitats",
  "subfam-tots-base",
  "subfam-tots-unitats",
  "menus-base",
  "menus-unitats",
]);

export default async function ConsultaVendesRestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{
    any?: string;
    mes?: string;
    centre?: string;
    vista?: string;
    detall?: string;
  }>;
}) {
  const sp = await searchParams;
  const [centres, anysVendes] = await Promise.all([
    getCentresRestaurantsVendes(),
    getAnysVendesRestaurants(),
  ]);

  const ara = new Date();
  const anyActual = sp.any ? Number(sp.any) : (anysVendes[0] ?? ara.getFullYear());
  const anys = anysVendes.length ? anysVendes : [anyActual];
  const mesRaw = sp.mes != null && sp.mes !== "" ? Number(sp.mes) : ara.getMonth() + 1;
  const mes = Number.isFinite(mesRaw) && mesRaw >= 0 && mesRaw <= 12 ? mesRaw : ara.getMonth() + 1;
  const vista: "comparativa" | "restaurant" =
    sp.vista === "restaurant" ? "restaurant" : "comparativa";
  const centreId = vista === "restaurant" ? (sp.centre ?? centres[0]?.id ?? null) : null;
  const detall: DetallVendes =
    sp.detall && DETALLS_OK.has(sp.detall) ? (sp.detall as DetallVendes) : "";

  const [comparativa, informe] = await Promise.all([
    vista === "comparativa" ? getComparativaVendes(anyActual, mes) : Promise.resolve(null),
    vista === "restaurant" && centreId
      ? getInformeVendesRestaurant(centreId, anyActual, mes)
      : Promise.resolve(null),
  ]);

  const fitBoard =
    !detall &&
    ((vista === "comparativa" && !!comparativa && !comparativa.buit) ||
      (vista === "restaurant" && !!informe && !informe.buit));

  return (
    <div className={`${styles.page} ${fitBoard ? boardStyles.pageFit : ""}`}>
      <div className={`${styles.headerRow} ${fitBoard ? boardStyles.headerFit : ""}`}>
        <div>
          <h1 className={`${styles.title} ${fitBoard ? boardStyles.titleFit : ""}`}>
            Vendes · restaurants
          </h1>
          {!fitBoard ? (
            <p className={styles.subtitle}>
              Lectura ràpida per al comitè: totals, tendència, mix i el que més es ven.
            </p>
          ) : null}
        </div>
        <VendesSelectors
          centres={centres}
          anys={anys}
          any={anyActual}
          mes={mes}
          centreId={centreId}
          vista={vista}
        />
      </div>

      {vista === "comparativa" ? (
        !comparativa || comparativa.buit ? (
          <div className={styles.prompt}>
            <h3>Sense vendes per aquest període</h3>
            <p>
              Puja els Excel V / Detall / Pack a{" "}
              <a href="/dades/vendes-restaurants">Dades → Vendes restaurants</a>.
            </p>
          </div>
        ) : (
          <VendesComparativaPresentacio
            data={comparativa}
            detall={detall}
            any={anyActual}
            mes={mes}
          />
        )
      ) : !informe || informe.buit ? (
        <div className={styles.prompt}>
          <h3>Sense dades d&apos;aquest restaurant</h3>
          <p>
            Comprova el període o importa els fitxers a{" "}
            <a href="/dades/vendes-restaurants">Dades → Vendes restaurants</a>.
          </p>
        </div>
      ) : (
        <VendesRestaurantPresentacio data={informe} detall={detall} any={anyActual} mes={mes} />
      )}
    </div>
  );
}
