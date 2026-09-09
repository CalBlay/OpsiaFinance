import { assertExternalApiKey, buildPctAnualGestio } from "@/lib/external/cost-pct-anual";
import { type NextRequest, NextResponse } from "next/server";

/**
 * API machine-to-machine per Cal Blay · Cost de serveis.
 * GET ?year=2026&grup=calblay
 *
 * Retorna % anual Compres i Gestió sobre ingressos — vista Gestió completa
 * (Directe + traspassos + repartiment Central), igual que RESULTATS Opsia.
 */
export async function GET(req: NextRequest) {
  if (!assertExternalApiKey(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const year = Number(req.nextUrl.searchParams.get("year"));
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Cal year vàlid (ex. year=2026)" }, { status: 400 });
  }

  const grup = req.nextUrl.searchParams.get("grup");

  try {
    const data = await buildPctAnualGestio(year, grup);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[external/cost-pct-anual]", err);
    return NextResponse.json({ error: "Error intern" }, { status: 500 });
  }
}
