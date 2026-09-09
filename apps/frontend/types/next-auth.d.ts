/**
 * Auth.js v5: User/Session viuen a `@auth/core/types` (next-auth només reexporta).
 * Augmentar `next-auth` sol no n'hi ha prou.
 */
import type { NavExtra } from "@/lib/nav-catalog";
import type { UserRole } from "@/types";

declare module "@auth/core/types" {
  interface User {
    id: string;
    role: UserRole;
    navExtra?: NavExtra;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    navExtra?: NavExtra;
  }
}

declare module "next-auth" {
  interface User {
    id: string;
    role: UserRole;
    navExtra?: NavExtra;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
      navExtra?: NavExtra;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    navExtra?: NavExtra;
  }
}
