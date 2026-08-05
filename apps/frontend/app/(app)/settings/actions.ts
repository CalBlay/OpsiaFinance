"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@/types";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/* ─── Crear usuari ───────────────────────────────────────────────────────────── */
export async function createUserAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return "No tens permisos per crear usuaris.";

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const role = formData.get("role") as UserRole;
  const password = formData.get("password") as string;

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return "Tots els camps obligatoris han d'estar omplerts.";
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return "Ja existeix un usuari amb aquest correu.";

  const passwordHash = await bcrypt.hash(password, 12);

  await db.user.create({
    data: { name: name.trim(), email: email.trim().toLowerCase(), role, passwordHash },
  });

  revalidatePath("/settings");
  redirect("/settings");
}

/* ─── Editar usuari ──────────────────────────────────────────────────────────── */
export async function updateUserAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return "No tens permisos.";

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const role = formData.get("role") as UserRole;

  if (!id || !name?.trim()) return "Dades incorrectes.";

  await db.user.update({
    where: { id },
    data: { name: name.trim(), role },
  });

  revalidatePath("/settings");
  redirect("/settings");
}

/* ─── Activar / desactivar usuari ───────────────────────────────────────────── */
export async function toggleUserActiveAction(id: string, isActive: boolean) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return;

  // No es pot desactivar el propi compte
  if (session.user.id === id) return;

  await db.user.update({ where: { id }, data: { isActive } });
  revalidatePath("/settings");
}
