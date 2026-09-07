import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import styles from "@/components/consultes/report.module.css";
import { auth } from "@/lib/auth";
import {
  potEditarPressupostDepartament,
  potVeurePressupostDepartament,
} from "@/lib/pressupost/access";
import { listCategoriesCatalogPerDept } from "@/lib/pressupost/partida-catalog";
import {
  getDepartamentPressupost,
  getPressupostDept,
  listAnysPressupostDept,
} from "@/lib/pressupost/pressupost-dept";
import { notFound, redirect } from "next/navigation";
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
  const session = await auth();
  const role = session?.user?.role;
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const potVeure = await potVeurePressupostDepartament({
    userId,
    role,
    departamentId,
  });
  if (!potVeure) redirect("/pressupost/departaments");

  const dept = await getDepartamentPressupost(departamentId);
  if (!dept) notFound();

  const anyNow = new Date().getFullYear();
  const anyParam = sp.any != null && sp.any !== "" ? Number(sp.any) : anyNow;
  const any =
    Number.isInteger(anyParam) && anyParam >= 2000 && anyParam <= 2100 ? anyParam : anyNow;

  const [canEdit, { capcalera, linies }, anysExistents, catalogCategories] = await Promise.all([
    potEditarPressupostDepartament({ userId, role, departamentId }),
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
        canEdit={canEdit}
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
