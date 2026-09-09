import { auth } from "@/lib/auth";
import { getArbreSeleccio } from "@/lib/consultes";
import { listDepartamentsPerCatalog } from "@/lib/pressupost/partida-catalog";
import { esAdmin } from "@/lib/roles";
import { redirect } from "next/navigation";
import { NouUsuariClient } from "./NouUsuariClient";

export const metadata = { title: "Nou usuari — OpsiaFinance" };

export default async function NouUsuariPage() {
  const session = await auth();
  if (!esAdmin(session?.user?.role)) redirect("/");

  const [departaments, arbre] = await Promise.all([
    listDepartamentsPerCatalog(),
    getArbreSeleccio(),
  ]);
  return <NouUsuariClient departaments={departaments} arbre={arbre} />;
}
