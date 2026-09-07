import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import styles from "@/components/consultes/report.module.css";
import { auth } from "@/lib/auth";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import {
  esPressupostDeptOnly,
  listDepartamentIdsUsuari,
  potVeureTotsDepartamentsPressupost,
} from "@/lib/pressupost/access";
import { mapEstatPressupostDeptAny } from "@/lib/pressupost/pressupost-dept";
import { carregarArbreDeptSc } from "@/lib/repartiment/personal-departaments-data";
import type { UserRole } from "@/types";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import local from "./page.module.css";

export const metadata = { title: "Pressupost per departament — OpsiaFinance" };

const CODI_OFICINES = "CCC00005";
const CODI_CUINA = "CCC00007";

type Search = { any?: string };

type DeptRow = { id: string; codi: string; nom: string };

async function CatalogContent({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const grup = await getGrupEmpresaActual();
  const session = await auth();
  const role = (session?.user?.role ?? "CONSULTA") as UserRole;
  const userId = session?.user?.id;

  if (grup === "fdlc") {
    return (
      <div className={styles.report}>
        <ConsultaHeader
          title="Pressupost per departament"
          subtitle="Tipus B — despesa Central (Oficines, Cuina…)."
        />
        <p className={local.hint}>
          Els departaments de Central són de Cal Blay. Canvia el selector Empresa a «Cal Blay» (o
          Consolidat) per veure’ls. Per FDLC usa «Per línia (vendes)».
        </p>
        <p className={local.back}>
          <Link href="/pressupost/ln">Anar a pressupost per LN →</Link>
        </p>
      </div>
    );
  }

  const anyNow = new Date().getFullYear();
  const anyParam = sp.any != null && sp.any !== "" ? Number(sp.any) : anyNow;
  const any =
    Number.isInteger(anyParam) && anyParam >= 2000 && anyParam <= 2100 ? anyParam : anyNow;

  const allowedIds = potVeureTotsDepartamentsPressupost(role)
    ? null
    : userId
      ? new Set(await listDepartamentIdsUsuari(userId))
      : new Set<string>();

  const arbre = await carregarArbreDeptSc();
  const filterDepts = (depts: DeptRow[]) =>
    allowedIds == null ? depts : depts.filter((d) => allowedIds.has(d.id));

  const oficinesRaw = arbre.find((c) => c.centreCodi === CODI_OFICINES);
  const cuinaRaw = arbre.find((c) => c.centreCodi === CODI_CUINA);
  const altresRaw = arbre.filter(
    (c) =>
      c.centreCodi !== CODI_OFICINES && c.centreCodi !== CODI_CUINA && c.departaments.length > 0
  );

  const oficines = oficinesRaw
    ? { ...oficinesRaw, departaments: filterDepts(oficinesRaw.departaments) }
    : null;
  const cuina = cuinaRaw ? { ...cuinaRaw, departaments: filterDepts(cuinaRaw.departaments) } : null;
  const altres = altresRaw
    .map((c) => ({ ...c, departaments: filterDepts(c.departaments) }))
    .filter((c) => c.departaments.length > 0);

  const totsIds = [
    ...(oficines?.departaments.map((d) => d.id) ?? []),
    ...(cuina?.departaments.map((d) => d.id) ?? []),
    ...altres.flatMap((c) => c.departaments.map((d) => d.id)),
  ];
  const estats = await mapEstatPressupostDeptAny(any, totsIds);

  const anysOpts = [anyNow + 1, anyNow, anyNow - 1].filter((a, i, arr) => arr.indexOf(a) === i);

  // Un sol dept assignat → anar-hi directament
  if (esPressupostDeptOnly(role) && totsIds.length === 1) {
    redirect(`/pressupost/departaments/${totsIds[0]}?any=${any}`);
  }

  return (
    <div className={styles.report}>
      <ConsultaHeader
        title="Pressupost per departament"
        subtitle={
          esPressupostDeptOnly(role)
            ? "Els teus departaments assignats."
            : "Tipus B — despesa detallada (dim-3). Escull un departament per començar."
        }
      />

      <div className={local.toolbar}>
        <div className={local.anyField}>
          <span className={local.anyLabel}>Any</span>
          <div className={local.anyLinks}>
            {anysOpts.map((a) => (
              <Link
                key={a}
                href={`/pressupost/departaments?any=${a}`}
                className={a === any ? local.anyChipActive : local.anyChip}
              >
                {a}
              </Link>
            ))}
          </div>
        </div>
        <p className={local.hintInline}>
          Clica un departament per crear o obrir el pressupost de {any}.
        </p>
      </div>

      <Section
        title="Oficines Cal Blay"
        subtitle={oficines ? `${oficines.centreCodi}` : CODI_OFICINES}
        depts={oficines?.departaments ?? []}
        any={any}
        estats={estats}
      />
      <Section
        title="Cuina central"
        subtitle={cuina ? `${cuina.centreCodi}` : CODI_CUINA}
        depts={cuina?.departaments ?? []}
        any={any}
        estats={estats}
      />

      {altres.map((c) => (
        <Section
          key={c.centreId}
          title={c.centreNom}
          subtitle={c.centreCodi}
          depts={c.departaments}
          any={any}
          estats={estats}
        />
      ))}

      {!oficines?.departaments.length && !cuina?.departaments.length && altres.length === 0 ? (
        <p className={local.empty}>
          {esPressupostDeptOnly(role)
            ? "No tens cap departament assignat. Demana-ho a un administrador."
            : "No s’han trobat departaments de Central. Importa l’arbre de dimensions a Configuració."}
        </p>
      ) : null}

      <p className={local.back}>
        <Link href="/pressupost">← Vista general</Link>
      </p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  depts,
  any,
  estats,
}: {
  title: string;
  subtitle: string;
  depts: DeptRow[];
  any: number;
  estats: Map<string, "ESBORRANY" | "CONFIRMAT">;
}) {
  if (depts.length === 0) return null;
  return (
    <section className={local.section}>
      <header className={local.sectionHead}>
        <h2 className={local.sectionTitle}>{title}</h2>
        <span className={local.sectionMeta}>{subtitle}</span>
      </header>
      <ul className={local.list}>
        {depts.map((d) => {
          const estat = estats.get(d.id);
          return (
            <li key={d.id}>
              <Link href={`/pressupost/departaments/${d.id}?any=${any}`} className={local.itemLink}>
                <span className={local.codi}>{d.codi}</span>
                <span className={local.nom}>{d.nom}</span>
                <span
                  className={
                    estat === "CONFIRMAT"
                      ? local.badgeOk
                      : estat === "ESBORRANY"
                        ? local.badgeDraft
                        : local.badgeStart
                  }
                >
                  {estat === "CONFIRMAT"
                    ? "Confirmat"
                    : estat === "ESBORRANY"
                      ? "Esborrany"
                      : "Començar"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function PressupostDepartamentsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return (
    <Suspense fallback={<p className={styles.report}>Carregant…</p>}>
      <CatalogContent searchParams={searchParams} />
    </Suspense>
  );
}
