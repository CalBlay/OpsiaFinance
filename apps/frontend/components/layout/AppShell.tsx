import { auth } from "@/lib/auth";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
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
export async function AppShell({ children }: AppShellProps) {
  const [session, grup] = await Promise.all([auth(), getGrupEmpresaActual()]);
  const role = session?.user?.role ?? "CONSULTA";
  const user = session?.user
    ? { name: session.user.name ?? "Usuari", role: session.user.role }
    : null;

  return (
    <div className={styles.root}>
      <Topbar user={user} grup={grup} />
      <div className={styles.body}>
        <Sidebar role={role} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
