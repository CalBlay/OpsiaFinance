/**
 * Auth.js v5: User/Session viuen a `@auth/core/types` (next-auth només reexporta).
 * Augmentar `next-auth` sol no n'hi ha prou.
 */
declare module "@auth/core/types" {
  interface User {
    id: string;
    role: "ADMIN" | "EDICIO" | "CONSULTA";
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: "ADMIN" | "EDICIO" | "CONSULTA";
  }
}

declare module "next-auth" {
  interface User {
    id: string;
    role: "ADMIN" | "EDICIO" | "CONSULTA";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "ADMIN" | "EDICIO" | "CONSULTA";
  }
}

export {};
