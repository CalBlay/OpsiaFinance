"use client";

import { type DeptOpt, UserForm } from "@/app/(app)/settings/UserForm";
import { updateUserAction } from "@/app/(app)/settings/actions";
import type { ArbreScopeOpt } from "@/lib/consulta-scope";
import type { NavExtra } from "@/lib/nav-catalog";
import type { UserRole } from "@/types";
import { useActionState } from "react";

type Initial = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departamentIds: string[];
  navExtra?: NavExtra;
};

export function EditUsuariClient({
  departaments,
  arbre,
  initial,
}: {
  departaments: DeptOpt[];
  arbre: ArbreScopeOpt[];
  initial: Initial;
}) {
  const [error, formAction, isPending] = useActionState(updateUserAction, null);

  return (
    <UserForm
      mode="edit"
      action={formAction}
      error={error}
      pending={isPending}
      initial={initial}
      departaments={departaments}
      arbre={arbre}
    />
  );
}
