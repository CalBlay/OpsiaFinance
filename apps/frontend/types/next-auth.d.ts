/**
 * Auth.js v5: User/Session viuen a `@auth/core/types` (next-auth només reexporta).
 * Augmentar `next-auth` sol no n'hi ha prou.
 */
import type { UserRole } from "@/types";

declare module "@auth/core/types" {
  interface User {
    id: string;
    role: UserRole;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
  }
}

declare module "next-auth" {
  interface User {
    id: string;
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
  }
}
