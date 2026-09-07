import type { ReactNode } from "react";
import { Suspense } from "react";
import styles from "../consultes/layout.module.css";
import { PressupostNav } from "./PressupostNav";

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
        <PressupostNav />
      </Suspense>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
