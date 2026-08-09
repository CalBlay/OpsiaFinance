import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const ICONS = new Set(["icon-192.png", "icon-512.png", "icon-maskable-512.png"]);

type Params = { params: Promise<{ name: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { name } = await params;
  if (!ICONS.has(name)) {
    return new NextResponse(null, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "app", name);
  try {
    const body = await readFile(filePath);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
