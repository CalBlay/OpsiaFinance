import { auth } from "@/lib/auth";
import { handleSingleImport } from "@/lib/import-upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ status: "error", message: "No autenticat." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const result = await handleSingleImport(formData, session.user.id);
    return Response.json(result);
  } catch (err) {
    console.error("POST /api/dades/upload:", err);
    return Response.json(
      { status: "error", message: "Error inesperat en pujar el fitxer." },
      { status: 500 }
    );
  }
}
