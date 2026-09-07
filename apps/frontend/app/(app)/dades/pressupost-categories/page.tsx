import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import { auth } from "@/lib/auth";
import {
  listCategoriesCatalog,
  listDepartamentsPerCatalog,
} from "@/lib/pressupost/partida-catalog";
import { potEditar } from "@/lib/roles";
import { Suspense } from "react";
import { CategoriesCatalogManager } from "./CategoriesCatalogManager";

export const metadata = { title: "Categories pressupost — OpsiaFinance" };

const tab = getDadesTabById("pressupost-categories");

async function Content() {
  const [session, categories, departaments] = await Promise.all([
    auth(),
    listCategoriesCatalog(),
    listDepartamentsPerCatalog(),
  ]);

  return (
    <DadesPageShell title={tab.title} description={tab.description}>
      <CategoriesCatalogManager
        categories={categories}
        departaments={departaments}
        canEdit={potEditar(session?.user?.role)}
      />
    </DadesPageShell>
  );
}

export default function PressupostCategoriesPage() {
  return (
    <Suspense fallback={<p>Carregant…</p>}>
      <Content />
    </Suspense>
  );
}
