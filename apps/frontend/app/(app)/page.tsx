import { IniciResumCharts } from "@/components/consultes/IniciResumCharts";
import { KpiInformeCards } from "@/components/consultes/KpiCards";
import { auth } from "@/lib/auth";
import { getComparativaEmpresa, getDarrerPeriodAmbDades } from "@/lib/consultes";
import { etiquetaGrafic } from "@/lib/consultes-grafics";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { etiquetaGrupEmpresa, grupPermetVistaGestio } from "@/lib/grups-empresa";
import {
  NODE_COMPRES,
  NODE_COST_GESTIO,
  NODE_COST_SALARIAL,
  NODE_INGRESSOS,
  NODE_VENDES,
  buildKpisEmpresa,
} from "@/lib/kpi-definitions";
import { MESOS_LLARGS } from "@/lib/periodes";
import { potAdministrar } from "@/lib/roles";
import { ArrowRight, BarChart3, GitCompareArrows, ShoppingBag, Users } from "lucide-react";
import Link from "next/link";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inici — OpsiaFinance" };

/** Línies d'ingrés detall (no subtotal) per al quesito FDLC. */
const NODES_INGRES_DETALL_FDLC: { node: number; label: string }[] = [
  { node: NODE_VENDES, label: "Vendes" },
  { node: 3, label: "Prestació de serveis" },
  { node: 4, label: "Altres ingressos" },
  { node: 5, label: "Variació existències" },
];

export default async function HomePage() {
  const [session, grup] = await Promise.all([auth(), getGrupEmpresaActual()]);
  const darrer = await getDarrerPeriodAmbDades(grup);

  const showAdmin = potAdministrar(session?.user?.role);
  const nomEmpresa = etiquetaGrupEmpresa(grup);

  let kpis: ReturnType<typeof buildKpisEmpresa> | null = null;
  let periodeLabel = "";
  let buit = true;
  let empresaHref = "/consultes/empresa";
  let pesIngressos: { name: string; value: number }[] = [];
  let titolIngressos = "Pes d'ingressos per línia";
  let costos: { name: string; value: number }[] = [];

  if (darrer) {
    const rang = { des: darrer.mes, fins: darrer.mes };
    periodeLabel = `${MESOS_LLARGS[darrer.mes - 1]} ${darrer.any}`;
    empresaHref = `/consultes/empresa?any=${darrer.any}&des=${darrer.mes}&fins=${darrer.mes}`;

    const potGestio = grupPermetVistaGestio(grup);
    const [comp, compGestio] = await Promise.all([
      getComparativaEmpresa(darrer.any, rang, "directe", grup),
      potGestio ? getComparativaEmpresa(darrer.any, rang, "gestio", grup) : Promise.resolve(null),
    ]);

    buit = comp.buit;
    if (!comp.buit) {
      kpis = buildKpisEmpresa((node) => comp.concepts.find((c) => c.node === node)?.total ?? 0);

      if (grup === "fdlc") {
        titolIngressos = "Composició d'ingressos";
        pesIngressos = NODES_INGRES_DETALL_FDLC.map(({ node, label }) => {
          const row = comp.concepts.find((c) => c.node === node);
          return { name: label, value: Math.max(0, row?.total ?? 0) };
        })
          .filter((s) => s.value > 0)
          .sort((a, b) => b.value - a.value);
      } else {
        const ingressosRow = comp.concepts.find((c) => c.node === NODE_INGRESSOS);
        const vendesRow = comp.concepts.find((c) => c.node === NODE_VENDES);
        const filaPes =
          (ingressosRow?.valors.some((v) => v > 0) ? ingressosRow : null) ??
          (vendesRow?.valors.some((v) => v > 0) ? vendesRow : ingressosRow);

        pesIngressos = comp.linies
          .map((l, i) => ({
            name: etiquetaGrafic(l),
            value: Math.max(0, filaPes?.valors[i] ?? 0),
          }))
          .filter((s) => s.value > 0)
          .sort((a, b) => b.value - a.value);
      }

      const fontCostos = compGestio ?? comp;
      const personal = Math.abs(
        fontCostos.concepts.find((c) => c.node === NODE_COST_SALARIAL)?.total ?? 0
      );
      const compres = Math.abs(
        fontCostos.concepts.find((c) => c.node === NODE_COMPRES)?.total ?? 0
      );
      const gestio = Math.abs(
        fontCostos.concepts.find((c) => c.node === NODE_COST_GESTIO)?.total ?? 0
      );
      costos = [
        { name: "Personal", value: Math.round(personal * 100) / 100 },
        { name: "Compres", value: Math.round(compres * 100) / 100 },
        { name: "Gestió", value: Math.round(gestio * 100) / 100 },
      ].filter((s) => s.value > 0);
    }
  }

  const shortcuts = [
    {
      href: empresaHref,
      label: "Compte d'empresa",
      hint: nomEmpresa,
      icon: BarChart3,
    },
    {
      href: "/consultes/comparativa",
      label: "Comparativa temporal",
      hint: "Any / període",
      icon: GitCompareArrows,
    },
    {
      href: "/consultes/quadre-mando",
      label: "Quadre de comandament",
      hint: "Restaurants",
      icon: ShoppingBag,
    },
    {
      href: "/consultes/cost-salarial",
      label: "Cost salarial",
      hint: "Restaurants",
      icon: Users,
    },
  ];

  const teGrafics = !buit && (pesIngressos.length > 0 || costos.length > 0);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{nomEmpresa}</p>
          <h1 className={styles.title}>Inici</h1>
          <p className={styles.subtitle}>
            {darrer
              ? `Dades de l'últim mes carregat · ${nomEmpresa} · ${periodeLabel}`
              : `Encara no hi ha períodes amb dades carregades per a ${nomEmpresa}`}
          </p>
        </div>
        {darrer && (
          <Link href={empresaHref} className={styles.cta}>
            Obrir resultats
            <ArrowRight size={16} strokeWidth={2} />
          </Link>
        )}
      </header>

      {kpis && !buit ? (
        <section className={styles.kpiSection} aria-label="Indicadors del darrer mes">
          <KpiInformeCards kpis={kpis} periodeLabel={periodeLabel} />
        </section>
      ) : (
        <div className={styles.empty}>
          <h3>Sense dades per mostrar</h3>
          <p>
            {showAdmin
              ? "Carrega un informe a Dades per veure els indicadors aquí."
              : "Quan hi hagi dades carregades, els indicadors apareixeran aquí."}
          </p>
          {showAdmin && (
            <Link href="/dades" className={styles.emptyLink}>
              Anar a Dades
            </Link>
          )}
        </div>
      )}

      {teGrafics && (
        <IniciResumCharts
          periodeLabel={periodeLabel}
          pesIngressos={pesIngressos}
          titolIngressos={titolIngressos}
          costos={costos}
        />
      )}

      <section className={styles.shortcutsSection}>
        <h2 className={styles.sectionTitle}>Accés ràpid</h2>
        <div className={styles.shortcuts}>
          {shortcuts.map((item) => (
            <Link key={item.href} href={item.href} className={styles.shortcut}>
              <span className={styles.shortcutIcon}>
                <item.icon size={18} strokeWidth={1.8} />
              </span>
              <span className={styles.shortcutText}>
                <span className={styles.shortcutLabel}>{item.label}</span>
                <span className={styles.shortcutHint}>{item.hint}</span>
              </span>
              <ArrowRight size={15} strokeWidth={1.8} className={styles.shortcutArrow} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
