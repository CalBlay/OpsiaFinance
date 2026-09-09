import { auth } from "@/lib/auth";
import { parseNavExtra } from "@/lib/nav-access";
import type { UserRole } from "@/types";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { DadesTabs } from "./DadesTabs";
import styles from "./layout.module.css";

async function Nav() {
  const session = await auth();
  const role = (session?.user?.role ?? "CONSULTA") as UserRole;
  const navExtra = parseNavExtra(session?.user?.navExtra);
  return <DadesTabs role={role} navExtra={navExtra} />;
}

export default function DadesLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.container}>
      <Suspense
        fallback={
          <header className={styles.moduleHeader}>
            <h2 className={styles.moduleTitle}>Dades</h2>
          </header>
        }
      >
        <Nav />
      </Suspense>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
