import {
  assertExternalApiKey,
  buildCostTraspassosServeis,
} from "@/lib/external/cost-traspassos-serveis";
import { type NextRequest, NextResponse } from "next/server";

/**
 * API machine-to-machine per Cal Blay · Cost de Serveis.
 * Només retorna traspassos confirmats de Cuina Central (tots els seus
 * departaments) cap a Empresa, Casaments, Foodlovers o Càtering intern.
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
    return NextResponse.json(await buildCostTraspassosServeis(year, month));
  } catch (error) {
    console.error("[external/cost-traspassos-serveis]", error);
    return NextResponse.json({ error: "Error intern" }, { status: 500 });
  }
}
