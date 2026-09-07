"use client";

import { type DeptOpt, UserForm } from "@/app/(app)/settings/UserForm";
import { updateUserAction } from "@/app/(app)/settings/actions";
import type { UserRole } from "@/types";
import { useActionState } from "react";

type Initial = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departamentIds: string[];
};

export function EditUsuariClient({
  departaments,
  initial,
}: {
  departaments: DeptOpt[];
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
    />
  );
}
