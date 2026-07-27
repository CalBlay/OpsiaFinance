import type { UserRole } from "@/types";

/*
 * Augmentació de tipus de Next-Auth per incloure
 * les propietats pròpies d'OpsiaFinance (id, role).
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
    };
  }

  interface User {
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
  }
}
