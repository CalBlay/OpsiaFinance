import type { NavExtra } from "@/lib/nav-catalog";
import { parseNavExtra } from "@/lib/nav-catalog";
import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/types";

/*
 * Configuració base d'autenticació — EDGE SAFE.
 * No importa res de Node.js (pg, bcrypt, db...).
 * Usada pel middleware i estesa per auth.ts (Node.js runtime).
 */
export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    // La protecció de rutes viu a middleware.ts (el wrapper auth((req)=>…)
    // no invoca `authorized` a Auth.js v5).
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { id: string; role: UserRole }).role;
        token.navExtra = parseNavExtra((user as { navExtra?: NavExtra }).navExtra);
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.navExtra = parseNavExtra(token.navExtra);
      }
      return session;
    },
  },
  providers: [], // els providers es defineixen a auth.ts (Node.js)
};
