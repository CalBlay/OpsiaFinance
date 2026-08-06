import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/types";

/*
 * Configuració base d'autenticació — EDGE SAFE.
 * No importa res de Node.js (pg, bcrypt, db...).
 * Usada pel middleware i estesa per auth.ts (Node.js runtime).
 */
export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      const isPublic = pathname === "/login";
      const isApiAuth = pathname.startsWith("/api/auth");

      if (isApiAuth) return true;
      if (isPublic && isLoggedIn) return Response.redirect(new URL("/", nextUrl));
      if (!isPublic && !isLoggedIn) return false; // → redirigeix a /login automàticament
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { id: string; role: UserRole }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role: UserRole } & typeof session.user).role =
          token.role as UserRole;
      }
      return session;
    },
  },
  providers: [], // els providers es defineixen a auth.ts (Node.js)
};
