"use server";

import { auth } from "@/lib/auth";
import { parseNavExtra } from "@/lib/nav-catalog";
import { esAdmin, potConfigurar, potEditar } from "@/lib/roles";

export async function requireAdminUser() {
  const session = await auth();
  if (!session?.user || !esAdmin(session.user.role)) return null;
  return session.user;
}

export async function requireDadesEditorId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const navExtra = parseNavExtra(session.user.navExtra);
  if (!potEditar(session.user.role, navExtra)) return null;
  return session.user.id;
}

export async function requireDadesEditor() {
  const session = await auth();
  if (!session?.user) return null;
  const navExtra = parseNavExtra(session.user.navExtra);
  if (!potEditar(session.user.role, navExtra)) return null;
  return session.user;
}

export async function requireSettingsEditor() {
  const session = await auth();
  if (!session?.user) return null;
  const navExtra = parseNavExtra(session.user.navExtra);
  if (!potConfigurar(session.user.role, navExtra)) return null;
  return { ...session.user, navExtra };
}
