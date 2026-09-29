import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { esSuperOAdmin } from "@/lib/roles";
import { llistaMapeigsOrgPlantilla } from "@/lib/rrhh-plantilla/service";
import styles from "../traspass-personal/page.module.css";
import { PlantillaRrhhSettingsPanel } from "./PlantillaRrhhSettingsPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plantilla RRHH — OpsiaFinance" };

export default async function PlantillaRrhhSettingsPage() {
  const session = await auth();
  const canEdit = esSuperOAdmin(session?.user?.role);

  const [mapeigs, arbre] = await Promise.all([
    llistaMapeigsOrgPlantilla(),
    db.liniaNegoci.findMany({
      where: { isActive: true },
      orderBy: { ordre: "asc" },
      select: {
        id: true,
        codi: true,
        nom: true,
        centres: {
          where: { isActive: true },
          orderBy: { ordre: "asc" },
          select: {
            id: true,
            codi: true,
            nom: true,
            departaments: {
              where: { isActive: true },
              orderBy: { ordre: "asc" },
              select: { id: true, codi: true, nom: true },
            },
          },
        },
      },
    }),
  ]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Plantilla RRHH</h1>
        <p className={styles.subtitle}>
          Mapeig del text d&apos;organització del fitxer de plantilla (caps per mes) cap a LN →
          centre → departament de Dimensions. Els prefixos <code>|</code> / <code>||</code>{" "}
          s&apos;ignoren en desar.
        </p>
      </header>
      <PlantillaRrhhSettingsPanel mapeigs={mapeigs} arbre={arbre} canEdit={canEdit} />
    </div>
  );
}
