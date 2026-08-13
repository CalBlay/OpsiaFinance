import { auth } from "@/lib/auth";
import { getExecucioTraspassPerPeriode } from "@/lib/traspass-personal/service";
import { TraspassExecucioPanel } from "../TraspassExecucioPanel";

export const dynamic = "force-dynamic";

export default async function TraspassPersonalDetallPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const { periodId } = await params;
  const session = await auth();
  const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "EDICIO";

  const execucioRaw = await getExecucioTraspassPerPeriode(periodId);

  const execucio = execucioRaw
    ? {
        id: execucioRaw.id,
        estat: execucioRaw.estat,
        nomFitxer: execucioRaw.nomFitxer,
        moviments: execucioRaw.moviments.map((m) => ({
          id: m.id,
          minuts: Number((m as { minuts?: unknown }).minuts ?? Math.round(Number(m.hores) * 60)),
          hores: Number(m.hores),
          tarifaHora: Number(m.tarifaHora),
          import_: Number(m.import_),
          departament: m.departament as "SALA" | "CUINA",
          centreOrigen: m.centreOrigen,
          centreDesti: m.centreDesti,
          departamentOrigen: m.departamentOrigen,
          departamentDesti: m.departamentDesti,
        })),
        alertes: execucioRaw.alertesJson
          ? (JSON.parse(execucioRaw.alertesJson) as {
              fila: number;
              empleado: string;
              organizaciones: string;
              proyecto: string;
              motiu: string;
            }[])
          : [],
      }
    : null;

  return (
    <TraspassExecucioPanel
      periodId={periodId}
      periodNom={execucioRaw?.period.nom ?? "—"}
      execucio={execucio}
      canEdit={canEdit}
    />
  );
}
