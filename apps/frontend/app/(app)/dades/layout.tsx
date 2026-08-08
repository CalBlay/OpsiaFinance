import type { ReactNode } from "react";
import { DadesTabs } from "./DadesTabs";
import styles from "./layout.module.css";

export default function DadesLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.container}>
      <DadesTabs />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
