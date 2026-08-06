import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

/*
 * Configuració completa d'autenticació — NODE.JS RUNTIME ONLY.
 * Estén authConfig amb el provider de credencials i accés a la BBDD.
 * NO importar des de middleware.ts.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            passwordHash: true,
          },
        });

        if (!user || !user.isActive || !user.passwordHash) return null;

        const passwordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!passwordValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
