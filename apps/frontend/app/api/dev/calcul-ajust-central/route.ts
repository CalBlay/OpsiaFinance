import { calcularAjustCompresCentralMarJul } from "@/lib/ajustos/calcul-central-mar-jul";
import { NextResponse } from "next/server";

/** Només desenvolupament local: retorna el càlcul Març–Juliol LN00000. */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const calc = await calcularAjustCompresCentralMarJul(2025);
  if (!calc) return NextResponse.json({ error: "Sense dades" }, { status: 404 });
  return NextResponse.json(calc);
}
