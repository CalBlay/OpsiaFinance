"use client";

import { type DeptOpt, UserForm } from "@/app/(app)/settings/UserForm";
import { createUserAction } from "@/app/(app)/settings/actions";
import type { ArbreScopeOpt } from "@/lib/consulta-scope";
import { useActionState } from "react";

export function NouUsuariClient({
  departaments,
  arbre,
}: {
  departaments: DeptOpt[];
  arbre: ArbreScopeOpt[];
}) {
  const [error, formAction, isPending] = useActionState(createUserAction, null);

  return (
    <UserForm
      mode="create"
      action={formAction}
      error={error}
      pending={isPending}
      departaments={departaments}
      arbre={arbre}
    />
  );
}
