import { auth } from "@/lib/auth";
import { getArbreSeleccio } from "@/lib/consultes";
import { db } from "@/lib/db";
import { parseNavExtra } from "@/lib/nav-catalog";
import { listDepartamentsPerCatalog } from "@/lib/pressupost/partida-catalog";
import { esAdmin } from "@/lib/roles";
import type { UserRole } from "@/types";
import { notFound, redirect } from "next/navigation";
import { EditUsuariClient } from "./EditUsuariClient";

export const metadata = { title: "Editar usuari — OpsiaFinance" };

export default async function EditUsuariPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (!esAdmin(session?.user?.role)) redirect("/");

  const { userId } = await params;
  const [user, departaments, arbre] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        navExtra: true,
        deptsPressupost: { select: { departamentId: true } },
      },
    }),
    listDepartamentsPerCatalog(),
    getArbreSeleccio(),
  ]);

  if (!user) notFound();

  return (
    <EditUsuariClient
      departaments={departaments}
      arbre={arbre}
      initial={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as UserRole,
        departamentIds: user.deptsPressupost.map((d) => d.departamentId),
        navExtra: parseNavExtra(user.navExtra),
      }}
    />
  );
}
