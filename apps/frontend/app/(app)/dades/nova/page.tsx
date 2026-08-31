import { getLiniesImportOptions } from "@/lib/consultes";
import { Suspense } from "react";
import { NovaImportForm } from "./NovaImportForm";
import { NovaImportSkeleton } from "./NovaImportSkeleton";

export const metadata = { title: "Nova importació — OpsiaFinance" };

async function NovaImportFormLoader() {
  const linies = await getLiniesImportOptions();
  return <NovaImportForm linies={linies} />;
}

export default function NovaDadesPage() {
  return (
    <Suspense fallback={<NovaImportSkeleton />}>
      <NovaImportFormLoader />
    </Suspense>
  );
}
