import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import { auth } from "@/lib/auth";
import { llistaCarreguesFitxer } from "@/lib/carrega-fitxer";
import { getComparativaPersonalMes } from "@/lib/cost-personal-centre/comparativa";
import { desglossarFilaPayroll } from "@/lib/cost-personal-centre/payroll-imports";
import { db } from "@/lib/db";
import { ComparativaPersonalPanel } from "./ComparativaPersonalPanel";
import { CostPersonalCentrePanel } from "./CostPersonalCentrePanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cost personal centre — OpsiaFinance" };

const tab = getDadesTabById("cost-personal-centre");

export default async function CostPersonalCentreDadesPage({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string; vista?: string }>;
}) {
  const sp = await searchParams;
  const mesFiltre = sp.mes ? Number(sp.mes) : null;
  const vista = sp.vista === "comparativa" ? "comparativa" : "registres";

  const [session, anysRaw, carregues] = await Promise.all([
    auth(),
    db.period.findMany({
      where: { costsPersonalsCentre: { some: {} } },
      select: { any: true },
      distinct: ["any"],
      orderBy: { any: "desc" },
    }),
    llistaCarreguesFitxer(["COST_PERSONAL_CENTRE", "COST_PERSONAL_MILLORES"]),
  ]);

  const anys = anysRaw.map((a) => a.any);
  if (!anys.length) anys.push(new Date().getFullYear());
  const anyFiltre = sp.any ? Number(sp.any) : anys[0];

  const role = session?.user?.role;
  const canEdit = role === "ADMIN" || role === "EDICIO";

  const comparativa =
    vista === "comparativa" && mesFiltre
      ? await getComparativaPersonalMes(anyFiltre, mesFiltre)
      : null;

  const registres =
    vista === "registres"
      ? await db.costPersonalCentre.findMany({
          where: {
            period: {
              any: anyFiltre,
              ...(mesFiltre ? { mes: mesFiltre } : {}),
            },
          },
          orderBy: [
            { period: { mes: "desc" } },
            { origen: "asc" },
            { centre: { codi: "asc" } },
            { departamentSalarial: "asc" },
          ],
          select: {
            id: true,
            origen: true,
            importBrut: true,
            segSocialEmpresa: true,
            totalSegSocial: true,
            costPersonal: true,
            textOrigen: true,
            departamentSalarial: true,
            period: { select: { nom: true, any: true, mes: true } },
            centre: { select: { codi: true, nom: true } },
          },
          take: 5000,
        })
      : [];

  return (
    <DadesPageShell title={tab.title} description={tab.description}>
      <nav
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        <a
          href={`/dades/cost-personal-centre?any=${anyFiltre}${mesFiltre ? `&mes=${mesFiltre}` : ""}`}
          style={{
            padding: "0.35rem 0.75rem",
            borderRadius: "0.4rem",
            textDecoration: "none",
            fontSize: "0.85rem",
            fontWeight: 600,
            background:
              vista === "registres" ? "var(--opsia-accent-primary, #2f6f6d)" : "transparent",
            color: vista === "registres" ? "#fff" : "inherit",
            border: "1px solid var(--color-border)",
          }}
        >
          Importacions
        </a>
        <a
          href={`/dades/cost-personal-centre?vista=comparativa&any=${anyFiltre}${mesFiltre ? `&mes=${mesFiltre}` : "&mes=1"}`}
          style={{
            padding: "0.35rem 0.75rem",
            borderRadius: "0.4rem",
            textDecoration: "none",
            fontSize: "0.85rem",
            fontWeight: 600,
            background:
              vista === "comparativa" ? "var(--opsia-accent-primary, #2f6f6d)" : "transparent",
            color: vista === "comparativa" ? "#fff" : "inherit",
            border: "1px solid var(--color-border)",
          }}
        >
          Comparativa SAP / Gestió
        </a>
      </nav>

      {vista === "comparativa" ? (
        <ComparativaPersonalPanel
          data={comparativa}
          anys={anys}
          filtreAny={anyFiltre}
          filtreMes={mesFiltre}
        />
      ) : (
        <CostPersonalCentrePanel
          canEdit={canEdit}
          anys={anys}
          filtreAny={anyFiltre}
          filtreMes={mesFiltre}
          carregues={carregues}
          registres={registres.map((r) => {
            const d = desglossarFilaPayroll(r);
            return {
              id: r.id,
              origen: (r.origen === "MILLORES" ? "Millores" : "Nòmina") as "Nòmina" | "Millores",
              centreLabel: `${r.centre.codi} · ${r.centre.nom}`,
              centreCodi: r.centre.codi,
              dept:
                r.departamentSalarial === "CUINA"
                  ? "Cuina"
                  : r.departamentSalarial === "SALA"
                    ? "Sala"
                    : "",
              importBrut: d.brut,
              provisioPaguesExtres: d.provisio,
              totalSegSocial: d.seguretatSocial,
              costPersonal: d.cost,
              textOrigen: r.textOrigen,
              periodNom: r.period.nom,
              periodAny: r.period.any,
              periodMes: r.period.mes,
            };
          })}
        />
      )}
    </DadesPageShell>
  );
}
