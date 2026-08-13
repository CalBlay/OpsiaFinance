import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncGrupsRepartiment } from "@/lib/repartiment/normes-default";
import {
  CODIS_LN_PERSONAL_COMERCIAL,
  CODIS_LN_PERSONAL_CONFIG,
} from "@/lib/repartiment/personal-departaments-constants";
import {
  carregarConfigPersonal,
  carregarCostPersonalDeptSc,
  desactivarNormesPersonalObsoletes,
  ensureConfigPersonalInicial,
} from "@/lib/repartiment/personal-departaments-data";
import { RepartimentSubNav } from "./RepartimentSubNav";
import styles from "./page.module.css";
import { PersonalRepartimentPanel } from "./personal/PersonalRepartimentPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Repartiment personal SC — OpsiaFinance" };

export default async function RepartimentSettingsPage() {
  const session = await auth();
  const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "EDICIO";

  await syncGrupsRepartiment();
  await ensureConfigPersonalInicial();
  await desactivarNormesPersonalObsoletes();

  const latestPeriod = await db.period.findFirst({
    where: { costsPersonalsCentre: { some: {} } },
    orderBy: [{ any: "desc" }, { mes: "desc" }],
    select: { any: true, mes: true, nom: true },
  });

  const refAny = latestPeriod?.any ?? new Date().getFullYear();
  const refMes = latestPeriod?.mes ?? 1;

  const [lns, costs, config] = await Promise.all([
    db.liniaNegoci.findMany({
      where: {
        codi: { in: [...CODIS_LN_PERSONAL_CONFIG, ...CODIS_LN_PERSONAL_COMERCIAL] },
        isActive: true,
      },
      orderBy: { codi: "asc" },
      select: { id: true, codi: true, nom: true },
    }),
    carregarCostPersonalDeptSc(refAny, refMes),
    carregarConfigPersonal(),
  ]);

  // Si un centre SC no té departaments i tampoc té cost salarial al mes de referència,
  // no l'hem de mostrar.
  const departaments = costs.map((c) => ({
    departamentId: c.departamentId,
    centreCodi: c.centreCodi,
    centreNom: c.centreNom,
    deptCodi: c.deptCodi,
    deptNom: c.deptNom,
    costRef: c.costPersonal,
  }));

  const lnsConfig = lns
    .filter((l) =>
      CODIS_LN_PERSONAL_CONFIG.includes(l.codi as (typeof CODIS_LN_PERSONAL_CONFIG)[number])
    )
    .map((l) => {
      const cfg = config.configsLn.find((c) => c.liniaNegociId === l.id);
      return {
        id: l.id,
        codi: l.codi,
        nom: l.nom,
        mode: cfg?.mode ?? ("PERCENT_DEPT" as const),
        importFixTotal: cfg?.importFixTotal ?? null,
      };
    });

  const lnsComercial = lns.filter((l) =>
    CODIS_LN_PERSONAL_COMERCIAL.includes(l.codi as (typeof CODIS_LN_PERSONAL_COMERCIAL)[number])
  );

  const pesDefecteMap = new Map(config.pesDefecte.map((p) => [p.liniaNegociId, p.pesDefecte]));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Repartiment</h1>
        <p className={styles.subtitle}>
          Imports fixos (00/01/04/05/06) des de Central; el sobrant a Empresa i Casaments: 50% a
          parts iguals i 50% pel pes de vendes entre les dues.
        </p>
        <RepartimentSubNav />
      </header>
      <PersonalRepartimentPanel
        lnsConfig={lnsConfig}
        lnsComercial={lnsComercial}
        departaments={departaments}
        assignacions={config.configsDept}
        pesDefecte={lnsComercial.map((l) => ({
          liniaNegociId: l.id,
          codi: l.codi,
          pesDefecte: pesDefecteMap.get(l.id) ?? 0.5,
        }))}
        refMesLabel={latestPeriod?.nom ?? null}
        canEdit={canEdit}
      />
    </div>
  );
}
