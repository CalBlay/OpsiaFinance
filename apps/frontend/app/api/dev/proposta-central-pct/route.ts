import { propostaAjustCentralPctSobreVendesGrup } from "@/lib/ajustos/proposta-central-pct-grup";
import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const calc = await propostaAjustCentralPctSobreVendesGrup(2025, 32.5921);
  if (!calc) return NextResponse.json({ error: "Sense dades" }, { status: 404 });
  return NextResponse.json(calc);
}
