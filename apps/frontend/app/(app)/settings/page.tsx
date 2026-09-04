import { RoleBadge, StatusBadge } from "@/components/ui/Badge";
import { FloatingAddButton } from "@/components/ui/FloatingAddButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateShort } from "@/lib/utils";
import { redirect } from "next/navigation";
import { UserRowActions } from "./UserRowActions";
import styles from "./page.module.css";

export const metadata = { title: "Configuració — OpsiaFinance" };

export default async function SettingsPage() {
  const [session, users] = await Promise.all([
    auth(),
    db.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    }),
  ]);

  if (session?.user?.role !== "ADMIN") {
    redirect("/");
  }

  const currentUserId = session?.user.id;
  const isAdmin = true;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <p className={styles.subtitle}>
          {users.length} usuari{users.length !== 1 ? "s" : ""}
        </p>
        {isAdmin && <FloatingAddButton href="/settings/nou" label="Nou usuari" />}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuari</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estat</TableHead>
            <TableHead>Alta</TableHead>
            {isAdmin && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                Encara no hi ha usuaris. Crea el primer amb el botó de dalt.
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{user.name}</span>
                    <span className={styles.userEmail}>{user.email}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <RoleBadge role={user.role} />
                </TableCell>
                <TableCell>
                  <StatusBadge isActive={user.isActive} />
                </TableCell>
                <TableCell className={styles.userEmail}>
                  {formatDateShort(user.createdAt)}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <UserRowActions
                      userId={user.id}
                      isActive={user.isActive}
                      isSelf={user.id === currentUserId}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
