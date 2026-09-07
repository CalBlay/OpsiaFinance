import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { listDepartamentsPerCatalog } from "@/lib/pressupost/partida-catalog";
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
  if (session?.user?.role !== "ADMIN") redirect("/");

  const { userId } = await params;
  const [user, departaments] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        deptsPressupost: { select: { departamentId: true } },
      },
    }),
    listDepartamentsPerCatalog(),
  ]);

  if (!user) notFound();

  return (
    <EditUsuariClient
      departaments={departaments}
      initial={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as UserRole,
        departamentIds: user.deptsPressupost.map((d) => d.departamentId),
      }}
    />
  );
}
