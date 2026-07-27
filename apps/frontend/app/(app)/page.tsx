import { ModuleCard } from "@/components/ui/ModuleCard";
import { Database, Settings } from "lucide-react";
import styles from "./page.module.css";

const MODULES = [
  {
    href: "/settings",
    icon: Settings,
    title: "Settings",
    description: "Gestió d'usuaris, rols i configuració del sistema",
    variant: "settings" as const,
  },
  {
    href: "/dades",
    icon: Database,
    title: "Dades",
    description: "Càrrega i gestió dels informes financers",
    variant: "dades" as const,
  },
];

export default function HomePage() {
  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        {MODULES.map((mod) => (
          <ModuleCard key={mod.href} {...mod} />
        ))}
      </div>
    </div>
  );
}
