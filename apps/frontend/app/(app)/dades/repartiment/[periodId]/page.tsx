import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { decimalToNumber } from "@/lib/repartiment/serialize";
import { notFound } from "next/navigation";
import { RepartimentExecucioPanel } from "../RepartimentExecucioPanel";

export const dynamic = "force-dynamic";

export default async function RepartimentDetallPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const { periodId } = await params;
  const session = await auth();
  const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "EDICIO";

  const period = await db.period.findUnique({
    where: { id: periodId },
    include: {
      execucioRepartiment: {
        include: {
          pesos: {
            include: {
              liniaNegoci: { select: { codi: true } },
              grup: { select: { codi: true } },
            },
          },
          moviments: {
            include: {
              liniaNegociDesti: { select: { codi: true } },
              norma: { select: { nom: true, tipus: true } },
            },
            orderBy: { concepteNode: "asc" },
          },
        },
      },
    },
  });

  if (!period) notFound();

  const execucio = period.execucioRepartiment
    ? {
        id: period.execucioRepartiment.id,
        estat: period.execucioRepartiment.estat,
        pesos: period.execucioRepartiment.pesos.map((p) => ({
          id: p.id,
          vendesBase: decimalToNumber(p.vendesBase) ?? 0,
          pesCalculat: decimalToNumber(p.pesCalculat) ?? 0,
          pesOverride: decimalToNumber(p.pesOverride),
          liniaNegoci: p.liniaNegoci,
          grup: p.grup,
        })),
        moviments: period.execucioRepartiment.moviments.map((m) => ({
          id: m.id,
          concepteNode: m.concepteNode,
          importCalculat: decimalToNumber(m.importCalculat) ?? 0,
          importOverride: decimalToNumber(m.importOverride),
          detallCalcul: m.detallCalcul,
          liniaNegociDesti: m.liniaNegociDesti,
          norma: m.norma,
        })),
      }
    : null;

  return (
    <RepartimentExecucioPanel
      periodId={period.id}
      periodNom={period.nom}
      execucio={execucio}
      canEdit={canEdit}
    />
  );
}
