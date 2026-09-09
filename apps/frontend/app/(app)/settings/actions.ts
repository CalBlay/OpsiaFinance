"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { defaultSubs, esRolRestringit } from "@/lib/nav-access";
import { type NavExtra, type NavModul, parseNavExtra } from "@/lib/nav-catalog";
import { esAdmin } from "@/lib/roles";
import type { UserRole } from "@/types";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const ROLES: UserRole[] = [
  "ADMIN",
  "SUPER_USUARI",
  "EDICIO",
  "CONSULTA",
  "PRESSUPOST_DEPT",
  "RESTAURACIO",
];

function parseRole(raw: FormDataEntryValue | null): UserRole | null {
  const v = String(raw ?? "");
  return ROLES.includes(v as UserRole) ? (v as UserRole) : null;
}

function parseDepartamentIds(formData: FormData): string[] {
  return [...new Set(formData.getAll("departamentIds").map(String).filter(Boolean))];
}

/** Desa només extras (fora del defecte del rol). */
function navExtraToStore(role: UserRole, raw: unknown): NavExtra | null {
  if (!esRolRestringit(role)) return null;
  const parsed = parseNavExtra(raw);
  const out: NavExtra = {};
  if (parsed.inici) out.inici = true;

  const trim = (modul: NavModul, ids: string[] | undefined) => {
    if (!ids?.length) return undefined;
    const def = new Set(defaultSubs(role, modul));
    const extra = ids.filter((id) => !def.has(id));
    return extra.length ? extra : undefined;
  };

  const r = trim("resultats", parsed.resultats);
  if (r) out.resultats = r as NavExtra["resultats"];
  const rest = trim("restaurants", parsed.restaurants);
  if (rest) out.restaurants = rest as NavExtra["restaurants"];
  const p = trim("pressupost", parsed.pressupost);
  if (p) out.pressupost = p as NavExtra["pressupost"];
  const d = trim("dades", parsed.dades);
  if (d) out.dades = d as NavExtra["dades"];
  const s = trim("settings", parsed.settings);
  if (s) out.settings = s as NavExtra["settings"];

  if (parsed.scope) {
    const sc = parsed.scope;
    const scope: NonNullable<NavExtra["scope"]> = {};
    if (sc.liniaNegociIds?.length) scope.liniaNegociIds = sc.liniaNegociIds;
    if (sc.centreIds?.length) scope.centreIds = sc.centreIds;
    if (sc.grups?.length) scope.grups = sc.grups;
    if (sc.vistes?.length) scope.vistes = sc.vistes;
    if (Object.keys(scope).length) out.scope = scope;
  }

  if (Object.keys(out).length === 0) {
    return role === "RESTAURACIO" ? {} : null;
  }
  return out;
}

function parseNavExtraField(formData: FormData, role: UserRole): NavExtra | null {
  const raw = formData.get("navExtra");
  if (!raw || typeof raw !== "string") return navExtraToStore(role, {});
  try {
    return navExtraToStore(role, JSON.parse(raw));
  } catch {
    return null;
  }
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
  if (!esAdmin(session?.user?.role)) return "No tens permisos per crear usuaris.";

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
  const navExtra = parseNavExtraField(formData, role);

  const user = await db.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      passwordHash,
      navExtra: navExtra === null ? Prisma.JsonNull : (navExtra as Prisma.InputJsonValue),
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
  if (!esAdmin(session?.user?.role)) return "No tens permisos.";

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

  const navExtra = parseNavExtraField(formData, role);

  const data: {
    name: string;
    role: UserRole;
    passwordHash?: string;
    navExtra: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  } = {
    name: name.trim(),
    role,
    navExtra: navExtra === null ? Prisma.JsonNull : (navExtra as Prisma.InputJsonValue),
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
  if (!session?.user || !esAdmin(session.user.role)) return;

  if (session.user.id === id) return;

  await db.user.update({ where: { id }, data: { isActive } });
  revalidatePath("/settings");
}
