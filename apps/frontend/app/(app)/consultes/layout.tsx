import type { ReactNode } from "react";
import { ConsultesNav } from "./ConsultesNav";
import styles from "./layout.module.css";

export default function ConsultesLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.container}>
      <ConsultesNav />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
