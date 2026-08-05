import { auth } from "@/lib/auth";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import Link from "next/link";
import { GrupEmpresaSelector } from "./GrupEmpresaSelector";
import styles from "./Topbar.module.css";
import { UserMenu } from "./UserMenu";

export async function Topbar() {
  const [session, grup] = await Promise.all([auth(), getGrupEmpresaActual()]);
  const user = session?.user;

  return (
    <header className={styles.topbar}>
      <GrupEmpresaSelector value={grup} />

      <Link href="/" className={styles.brand} aria-label="OpsiaFinance — Inici">
        <span className={styles.brandOpsia}>Opsia</span>
        <span className={styles.brandFinance}>Finance</span>
      </Link>

      <div className={styles.actions}>
        {user && <UserMenu name={user.name ?? "Usuari"} role={user.role} />}
      </div>
    </header>
  );
}
