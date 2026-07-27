"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function loginAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
    return null;
  } catch (error) {
    // Auth.js llança el redirect com a error — cal re-llançar-lo
    if (error instanceof AuthError) {
      return "Correu electrònic o contrasenya incorrectes.";
    }
    throw error;
  }
}
