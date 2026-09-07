"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@/types";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const ROLES: UserRole[] = ["ADMIN", "EDICIO", "CONSULTA", "PRESSUPOST_DEPT"];

function parseRole(raw: FormDataEntryValue | null): UserRole | null {
  const v = String(raw ?? "");
  return ROLES.includes(v as UserRole) ? (v as UserRole) : null;
}

function parseDepartamentIds(formData: FormData): string[] {
  return [...new Set(formData.getAll("departamentIds").map(String).filter(Boolean))];
}

async function syncUserDepartaments(userId: string, role: UserRole, deptIds: string[]) {
  await db.userDepartament.deleteMany({ where: { userId } });
  if (role !== "PRESSUPOST_DEPT") return;
  if (!deptIds.length) return;
  const valid = await db.departament.findMany({
    where: { id: { in: deptIds }, isActive: true },
    select: { id: true },
  });
  if (valid.length) {
    await db.userDepartament.createMany({
      data: valid.map((d) => ({ userId, departamentId: d.id })),
    });
  }
}

/* ─── Crear usuari ───────────────────────────────────────────────────────────── */
export async function createUserAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return "No tens permisos per crear usuaris.";

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const role = parseRole(formData.get("role"));
  const password = formData.get("password") as string;
  const departamentIds = parseDepartamentIds(formData);

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return "Tots els camps obligatoris han d'estar omplerts.";
  }
  if (!role) return "Rol no vàlid.";
  if (role === "PRESSUPOST_DEPT" && departamentIds.length === 0) {
    return "Cal assignar almenys un departament.";
  }

  const existing = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (existing) return "Ja existeix un usuari amb aquest correu.";

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      passwordHash,
    },
    select: { id: true },
  });

  await syncUserDepartaments(user.id, role, departamentIds);

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
  const role = parseRole(formData.get("role"));
  const password = (formData.get("password") as string | null)?.trim() ?? "";
  const departamentIds = parseDepartamentIds(formData);

  if (!id || !name?.trim()) return "Dades incorrectes.";
  if (!role) return "Rol no vàlid.";
  if (role === "PRESSUPOST_DEPT" && departamentIds.length === 0) {
    return "Cal assignar almenys un departament.";
  }

  const data: { name: string; role: UserRole; passwordHash?: string } = {
    name: name.trim(),
    role,
  };
  if (password) {
    if (password.length < 8) return "La contrasenya ha de tenir almenys 8 caràcters.";
    data.passwordHash = await bcrypt.hash(password, 12);
  }

  await db.user.update({ where: { id }, data });
  await syncUserDepartaments(id, role, departamentIds);

  revalidatePath("/settings");
  revalidatePath(`/settings/${id}`);
  redirect("/settings");
}

/* ─── Activar / desactivar usuari ───────────────────────────────────────────── */
export async function toggleUserActiveAction(id: string, isActive: boolean) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return;

  if (session.user.id === id) return;

  await db.user.update({ where: { id }, data: { isActive } });
  revalidatePath("/settings");
}
