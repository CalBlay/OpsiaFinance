import type { ReactNode } from "react";
import { Suspense } from "react";
import { DadesTabs } from "./DadesTabs";
import styles from "./layout.module.css";

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
        <DadesTabs />
      </Suspense>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
