import { getArbreSeleccio } from "@/lib/consultes";
import { ensureFdlcSetup } from "@/lib/fdlc/setup";
import { NovaImportForm } from "./NovaImportForm";

export const metadata = { title: "Nova importació — OpsiaFinance" };

export default async function NovaDadesPage() {
  await ensureFdlcSetup();
  const arbre = await getArbreSeleccio();
  const linies = arbre.map((ln) => ({ id: ln.id, codi: ln.codi, nom: ln.nom }));

  return <NovaImportForm linies={linies} />;
}
