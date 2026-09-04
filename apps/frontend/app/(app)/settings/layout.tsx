import { auth } from "@/lib/auth";
import { potConfigurar } from "@/lib/roles";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SettingsNav } from "./SettingsNav";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!potConfigurar(session.user.role)) redirect("/");

  return <SettingsNav showUsuaris>{children}</SettingsNav>;
}
