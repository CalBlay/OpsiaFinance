"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

export async function canviarContrasenyaAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return "Has d'iniciar sessió.";

  const actual = (formData.get("actual") as string) ?? "";
  const nova = (formData.get("nova") as string) ?? "";
  const confirmacio = (formData.get("confirmacio") as string) ?? "";

  if (!actual.trim() || !nova.trim() || !confirmacio.trim()) {
    return "Omple tots els camps.";
  }
  if (nova.length < 8) {
    return "La nova contrasenya ha de tenir com a mínim 8 caràcters.";
  }
  if (nova !== confirmacio) {
    return "La confirmació no coincideix amb la nova contrasenya.";
  }
  if (nova === actual) {
    return "La nova contrasenya ha de ser diferent de l'actual.";
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, isActive: true },
  });

  if (!user?.passwordHash || !user.isActive) {
    return "No s'ha pogut canviar la contrasenya.";
  }

  const ok = await bcrypt.compare(actual, user.passwordHash);
  if (!ok) return "La contrasenya actual no és correcta.";

  const passwordHash = await bcrypt.hash(nova, 12);
  await db.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  redirect("/compte/contrasenya?ok=1");
}
