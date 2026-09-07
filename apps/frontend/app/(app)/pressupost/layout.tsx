import { auth } from "@/lib/auth";
import type { UserRole } from "@/types";
import type { ReactNode } from "react";
import { Suspense } from "react";
import styles from "../consultes/layout.module.css";
import { PressupostNav } from "./PressupostNav";

async function Nav() {
  const session = await auth();
  const role = (session?.user?.role ?? "CONSULTA") as UserRole;
  return <PressupostNav role={role} />;
}

export default function PressupostLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.container}>
      <Suspense
        fallback={
          <header className={styles.moduleHeader}>
            <h2 className={styles.moduleTitle}>Pressupost</h2>
          </header>
        }
      >
        <Nav />
      </Suspense>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
