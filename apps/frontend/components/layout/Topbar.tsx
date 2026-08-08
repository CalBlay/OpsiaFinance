import type { GrupEmpresa } from "@/lib/grups-empresa";
import type { UserRole } from "@/types";
import Link from "next/link";
import { GrupEmpresaSelector } from "./GrupEmpresaSelector";
import styles from "./Topbar.module.css";
import { UserMenu } from "./UserMenu";

interface TopbarProps {
  user: { name: string; role: UserRole } | null;
  grup: GrupEmpresa;
}

/** Topbar síncron: sessió i grup venen de l'AppShell (un sol await). */
export function Topbar({ user, grup }: TopbarProps) {
  return (
    <header className={styles.topbar}>
      <GrupEmpresaSelector value={grup} />

      <Link href="/" className={styles.brand} aria-label="OpsiaFinance — Inici">
        <span className={styles.brandOpsia}>Opsia</span>
        <span className={styles.brandFinance}>Finance</span>
      </Link>

      <div className={styles.actions}>{user && <UserMenu name={user.name} role={user.role} />}</div>
    </header>
  );
}
