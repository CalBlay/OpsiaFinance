import type { ConceptePivot } from "@/lib/consultes";
import { MESOS_LLARGS } from "@/lib/periodes";

export function parseMesosParam(raw: string | undefined): number[] | null {
  if (!raw) return null;
  const mesos = raw
    .split(",")
    .map(Number)
    .filter((m) => m >= 1 && m <= 12);
  return mesos.length ? [...new Set(mesos)].sort((a, b) => a - b) : null;
}

export function sumMesos(valors: number[], mesos: number[]): number {
  return mesos.reduce((acc, m) => acc + (valors[m - 1] ?? 0), 0);
}

export function valorsMesos(valors: number[], mesos: number[]): number[] {
  return mesos.map((m) => valors[m - 1] ?? 0);
}

export function inferDefaultMesos(rows: ConceptePivot[] | undefined, nodeVendes: number): number[] {
  const vendes = rows?.find((c) => c.node === nodeVendes);
  if (!vendes) return Array.from({ length: 12 }, (_, i) => i + 1);
  const mesos = vendes.valors.map((v, i) => (v !== 0 ? i + 1 : 0)).filter((m) => m > 0);
  return mesos.length ? mesos : Array.from({ length: 12 }, (_, i) => i + 1);
}

export function labelMesos(mesos: number[]): string {
  const sorted = [...mesos].sort((a, b) => a - b);
  if (sorted.length === 12) return "Any complet";
  if (sorted.length === 1) return MESOS_LLARGS[sorted[0] - 1];
  const consecutiu = sorted.every((m, i) => i === 0 || m === sorted[i - 1] + 1);
  if (consecutiu)
    return `${MESOS_LLARGS[sorted[0] - 1]}–${MESOS_LLARGS[sorted[sorted.length - 1] - 1]}`;
  return sorted.map((m) => MESOS_LLARGS[m - 1]).join(", ");
}

export function filtraConceptesPerMesos(
  concepts: ConceptePivot[],
  mesos: number[]
): ConceptePivot[] {
  return concepts.map((c) => {
    const valors = valorsMesos(c.valors, mesos);
    return { ...c, valors, total: valors.reduce((a, b) => a + b, 0) };
  });
}
