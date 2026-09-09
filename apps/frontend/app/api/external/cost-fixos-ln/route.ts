import { assertExternalApiKey, buildCostSalarialLn } from "@/lib/external/cost-fixos-ln";
import { type NextRequest, NextResponse } from "next/server";

/**
 * API machine-to-machine per Cal Blay · Cost de serveis.
 * GET ?year=2026&month=9
 * Authorization: Bearer <OPSIA_EXTERNAL_API_KEY>
 *
 * Retorna TOTAL COST SALARIAL (node 17) vista SAP per totes les LN.
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
      { error: "Cal year i month vàlids (ex. year=2026&month=9)" },
      { status: 400 }
    );
  }

  try {
    const data = await buildCostSalarialLn(year, month);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[external/cost-fixos-ln]", err);
    return NextResponse.json({ error: "Error intern" }, { status: 500 });
  }
}
