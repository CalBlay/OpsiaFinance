import { listDepartamentsPerCatalog } from "@/lib/pressupost/partida-catalog";
import { NouUsuariClient } from "./NouUsuariClient";

export const metadata = { title: "Nou usuari — OpsiaFinance" };

export default async function NouUsuariPage() {
  const departaments = await listDepartamentsPerCatalog();
  return <NouUsuariClient departaments={departaments} />;
}
