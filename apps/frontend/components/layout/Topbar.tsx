import { auth } from "@/lib/auth";
import Link from "next/link";
import styles from "./Topbar.module.css";
import { UserMenu } from "./UserMenu";

export async function Topbar() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className={styles.topbar}>
      <div />

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
