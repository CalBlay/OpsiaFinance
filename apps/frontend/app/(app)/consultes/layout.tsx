import type { ReactNode } from "react";
import { Suspense } from "react";
import { ConsultesNav } from "./ConsultesNav";
import styles from "./layout.module.css";

export default function ConsultesLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.container}>
      <Suspense
        fallback={
          <header className={styles.moduleHeader}>
            <h2 className={styles.moduleTitle}>Consultes</h2>
          </header>
        }
      >
        <ConsultesNav />
      </Suspense>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
