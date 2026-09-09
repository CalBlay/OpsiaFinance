import { auth } from "@/lib/auth";
import { homeHrefPerRol, parseNavExtra, potVeureModul, potVeureSub } from "@/lib/nav-access";
import { esAdmin } from "@/lib/roles";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SettingsNav } from "./SettingsNav";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  const navExtra = parseNavExtra(session.user.navExtra);
  if (!potVeureModul(role, "settings", navExtra)) {
    redirect(homeHrefPerRol(role, navExtra));
  }

  const allowedSubs = [
    "usuaris",
    "dimensions",
    "compte-resultats",
    "formules",
    "repartiment",
    "traspass-personal",
    "cost-personal-centre",
    "consolidacio",
  ].filter((id) => potVeureSub(role, "settings", id, navExtra));

  return (
    <SettingsNav showUsuaris={esAdmin(role)} allowedSubs={allowedSubs}>
      {children}
    </SettingsNav>
  );
}
