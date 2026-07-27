import { auth } from "@/lib/auth";
import { getCentresRestaurants } from "@/lib/cost-salarial/consultes";
import { db } from "@/lib/db";
import { CostSalarialManager } from "./CostSalarialManager";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cost salarial restaurants — OpsiaFinance" };

export default async function CostSalarialDadesPage({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string }>;
}) {
  const sp = await searchParams;
  const anyFiltre = sp.any ? Number(sp.any) : null;
  const mesFiltre = sp.mes ? Number(sp.mes) : null;

  const [session, centres, anysRaw, registres] = await Promise.all([
    auth(),
    getCentresRestaurants(),
    db.period.findMany({
      where: { costsSalarials: { some: {} } },
      select: { any: true },
      distinct: ["any"],
      orderBy: { any: "desc" },
    }),
    db.costSalarialRestaurant.findMany({
      where: {
        ...(anyFiltre || mesFiltre
          ? {
              period: {
                ...(anyFiltre ? { any: anyFiltre } : {}),
                ...(mesFiltre ? { mes: mesFiltre } : {}),
              },
            }
          : {}),
      },
      orderBy: [
        { period: { any: "desc" } },
        { period: { mes: "desc" } },
        { centre: { codi: "asc" } },
        { departament: "asc" },
      ],
      select: {
        id: true,
        departament: true,
        totalSalari: true,
        incentiusMensual: true,
        incentiuTrimestral: true,
        horesExtres: true,
        altres: true,
        baixes: true,
        indemnitzacions: true,
        foraCentre: true,
        notes: true,
        updatedAt: true,
        period: { select: { any: true, mes: true, nom: true } },
        centre: { select: { id: true, codi: true, nom: true } },
      },
      take: 500,
    }),
  ]);

  const role = session?.user?.role;
  const canEdit = role === "ADMIN" || role === "EDICIO";
  const anys = anysRaw.map((a) => a.any);
  if (!anys.length) anys.push(new Date().getFullYear());

  const registresPlain = registres.map((r) => ({
    id: r.id,
    departament: r.departament as "SALA" | "CUINA",
    totalSalari: Number(r.totalSalari),
    incentiusMensual: Number(r.incentiusMensual),
    incentiuTrimestral: Number(r.incentiuTrimestral),
    horesExtres: Number(r.horesExtres),
    altres: Number(r.altres),
    baixes: Number(r.baixes),
    indemnitzacions: Number(r.indemnitzacions),
    foraCentre: Number(r.foraCentre),
    notes: r.notes,
    updatedAt: r.updatedAt.toISOString(),
    periodAny: r.period.any,
    periodMes: r.period.mes,
    periodNom: r.period.nom,
    centreId: r.centre.id,
    centreLabel: `${r.centre.codi} · ${r.centre.nom}`,
  }));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <p className={styles.subtitle}>
          Font pròpia de cost salarial per restaurant (Sala / Cuina). Puja l&apos;Excel mensual
          (només afegeix o actualitza línies) o edita manualment. {registresPlain.length} registre
          {registresPlain.length !== 1 ? "s" : ""}
          {anyFiltre || mesFiltre ? " (filtre actiu)" : ""}.
        </p>
      </div>

      <CostSalarialManager
        centres={centres}
        anys={anys}
        registres={registresPlain}
        canEdit={canEdit}
        filtreAny={anyFiltre}
        filtreMes={mesFiltre}
      />
    </div>
  );
}
