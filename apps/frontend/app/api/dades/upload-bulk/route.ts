import { auth } from "@/lib/auth";
import { handleBulkImport } from "@/lib/import-upload";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ status: "error", message: "No autenticat." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const result = await handleBulkImport(formData, session.user.id);
    return Response.json(result);
  } catch (err) {
    console.error("POST /api/dades/upload-bulk:", err);
    return Response.json(
      { status: "error", message: "Error inesperat en la pujada massiva." },
      { status: 500 }
    );
  }
}
