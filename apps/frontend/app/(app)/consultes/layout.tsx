"use client";

import { GRUP_COOKIE_NAME } from "@/lib/grup-cookie-name";
import {
  type GrupEmpresa,
  grupMostraConsultesLiniaCentre,
  parseGrupEmpresa,
} from "@/lib/grups-empresa";
import { cn } from "@/lib/utils";
import {
  Building2,
  GitCompareArrows,
  Landmark,
  Layers,
  LayoutDashboard,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./layout.module.css";

const RESULTATS_TABS = [
  { href: "/consultes/empresa", label: "Empresa", icon: Landmark },
  { href: "/consultes/evolucio", label: "Evolució mensual", icon: TrendingUp },
  { href: "/consultes/linia", label: "Per línia", icon: Layers, calBlay: true },
  { href: "/consultes/centre", label: "Per centre", icon: Building2, calBlay: true },
  { href: "/consultes/comparativa", label: "Comparativa temporal", icon: GitCompareArrows },
] as const;

const RESTAURANTS_TABS = [
  { href: "/consultes/quadre-mando", label: "Quadre de comandament", icon: LayoutDashboard },
  { href: "/consultes/vendes-restaurants", label: "Vendes", icon: ShoppingBag },
  { href: "/consultes/cost-salarial", label: "Cost salarial", icon: Users },
] as const;

function isRestaurantsPath(pathname: string): boolean {
  return (
    pathname.startsWith("/consultes/quadre-mando") ||
    pathname.startsWith("/consultes/vendes-restaurants") ||
    pathname.startsWith("/consultes/cost-salarial")
  );
}

function readGrupCookie(): GrupEmpresa {
  if (typeof document === "undefined") return "calblay";
  const raw = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${GRUP_COOKIE_NAME}=`))
    ?.split("=")[1];
  return parseGrupEmpresa(raw);
}

export default function ConsultesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [grup, setGrup] = useState<GrupEmpresa>("calblay");

  useEffect(() => {
    setGrup(readGrupCookie());
    const onFocus = () => setGrup(readGrupCookie());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const restaurants = isRestaurantsPath(pathname);
  const mostraLiniaCentre = grupMostraConsultesLiniaCentre(grup);
  const tabs = restaurants
    ? RESTAURANTS_TABS
    : RESULTATS_TABS.filter((t) => !("calBlay" in t && t.calBlay) || mostraLiniaCentre);
  const title = restaurants ? "Restaurants" : "Resultats";
  const navLabel = restaurants ? "Consultes de restaurants" : "Consultes de resultats";

  return (
    <div className={styles.container}>
      <header className={styles.moduleHeader}>
        <h2 className={styles.moduleTitle}>{title}</h2>
        <nav className={styles.tabs} aria-label={navLabel}>
          {tabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(styles.tab, isActive && styles.tabActive)}
                aria-current={isActive ? "page" : undefined}
              >
                <tab.icon size={15} strokeWidth={1.8} />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className={styles.content}>{children}</main>
    </div>
  );
}
