import type { ReactNode } from "react";
import styles from "./AppShell.module.css";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface AppShellProps {
  children: ReactNode;
}

/*
 * Shell permanent de l'aplicació.
 * Tots els mòduls autenticats estan envoltats per aquest component.
 * La seva estructura NO canvia entre pàgines.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className={styles.root}>
      <Topbar />
      <div className={styles.body}>
        <Sidebar />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
