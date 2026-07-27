import { getResumTraspassPersonal } from "@/lib/traspass-personal/resum";
import { ResumTraspassPanel } from "./ResumTraspassPanel";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resum traspassos personal — OpsiaFinance" };

export default async function ResumTraspassPersonalPage({
  searchParams,
}: {
  searchParams: Promise<{ any?: string }>;
}) {
  const sp = await searchParams;
  const anyDefault = new Date().getFullYear();
  const resumProbe = await getResumTraspassPersonal(sp.any ? Number(sp.any) : anyDefault);
  const any =
    sp.any && resumProbe.anysDisponibles.includes(Number(sp.any))
      ? Number(sp.any)
      : (resumProbe.anysDisponibles[0] ?? anyDefault);

  const resum = any === resumProbe.any ? resumProbe : await getResumTraspassPersonal(any);

  return (
    <div className={styles.page}>
      <ResumTraspassPanel resum={resum} />
    </div>
  );
}
