import { auth } from "@/lib/auth";
import { esAdmin } from "@/lib/roles";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SettingsNav } from "./SettingsNav";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <SettingsNav showUsuaris={esAdmin(session.user.role)}>{children}</SettingsNav>;
}
