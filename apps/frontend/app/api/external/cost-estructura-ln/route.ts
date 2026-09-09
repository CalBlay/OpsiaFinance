import { assertExternalApiKey, buildCostEstructuraLn } from "@/lib/external/cost-estructura-ln";
import { type NextRequest, NextResponse } from "next/server";

/**
 * API machine-to-machine per Cal Blay · Cost de serveis.
 * GET ?year=2026&month=7
 * Authorization: Bearer <OPSIA_EXTERNAL_API_KEY>
 *
 * Estructura Central per LN, total real de personal en vista Gestió i part de
 * Logística+Cuina Central ja imputada als pots gestió/prep/rentat.
 */
export async function GET(req: NextRequest) {
  if (!assertExternalApiKey(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const year = Number(req.nextUrl.searchParams.get("year"));
  const month = Number(req.nextUrl.searchParams.get("month"));
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12
  ) {
    return NextResponse.json(
      { error: "Cal year i month vàlids (ex. year=2026&month=7)" },
      { status: 400 }
    );
  }

  try {
    const data = await buildCostEstructuraLn(year, month);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[external/cost-estructura-ln]", err);
    return NextResponse.json({ error: "Error intern" }, { status: 500 });
  }
}
