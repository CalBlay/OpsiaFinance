import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import styles from "@/components/consultes/report.module.css";
import { auth } from "@/lib/auth";
import { listCategoriesCatalogPerDept } from "@/lib/pressupost/partida-catalog";
import {
  getDepartamentPressupost,
  getPressupostDept,
  listAnysPressupostDept,
} from "@/lib/pressupost/pressupost-dept";
import { potEditarPressupost } from "@/lib/roles";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PressupostDeptManager } from "../PressupostDeptManager";

export const metadata = { title: "Pressupost departament — OpsiaFinance" };

type Search = { any?: string };

async function DeptPageContent({
  departamentId,
  searchParams,
}: {
  departamentId: string;
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const dept = await getDepartamentPressupost(departamentId);
  if (!dept) notFound();

  const anyNow = new Date().getFullYear();
  const anyParam = sp.any != null && sp.any !== "" ? Number(sp.any) : anyNow;
  const any =
    Number.isInteger(anyParam) && anyParam >= 2000 && anyParam <= 2100 ? anyParam : anyNow;

  const [session, { capcalera, linies }, anysExistents, catalogCategories] = await Promise.all([
    auth(),
    getPressupostDept(any, dept.id),
    listAnysPressupostDept(),
    listCategoriesCatalogPerDept(dept.id),
  ]);

  return (
    <div className={styles.report}>
      <ConsultaHeader
        title="Pressupost per departament"
        subtitle="Tipus B — tria una categoria, descriu la partida i defineix imports i calendari."
      />
      <PressupostDeptManager
        anyInicial={any}
        dept={dept}
        capcalera={capcalera}
        linies={linies}
        catalogCategories={catalogCategories}
        anysExistents={anysExistents}
        canEdit={potEditarPressupost(session?.user?.role)}
      />
    </div>
  );
}

export default function PressupostDeptPage({
  params,
  searchParams,
}: {
  params: Promise<{ deptId: string }>;
  searchParams: Promise<Search>;
}) {
  return (
    <Suspense fallback={<p className={styles.report}>Carregant…</p>}>
      <DeptPageInner params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function DeptPageInner({
  params,
  searchParams,
}: {
  params: Promise<{ deptId: string }>;
  searchParams: Promise<Search>;
}) {
  const { deptId } = await params;
  return <DeptPageContent departamentId={deptId} searchParams={searchParams} />;
}
