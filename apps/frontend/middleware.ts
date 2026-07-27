import { authConfig } from "@/lib/auth.config";
import NextAuth from "next-auth";

/*
 * Middleware — EDGE RUNTIME.
 * Usa authConfig (edge-safe): sense imports de Node.js.
 * Llegeix el JWT de la cookie i verifica si l'usuari és autenticat.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
