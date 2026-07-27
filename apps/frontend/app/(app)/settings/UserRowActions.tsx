"use client";

import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { useTransition } from "react";
import { toggleUserActiveAction } from "./actions";

interface UserRowActionsProps {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
}

export function UserRowActions({ userId, isActive, isSelf }: UserRowActionsProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(() => {
      toggleUserActiveAction(userId, !isActive);
    });
  }

  return (
    <div style={{ display: "flex", gap: "8px" }}>
      <Link href={`/settings/${userId}`}>
        <Button variant="secondary" size="sm">
          Editar
        </Button>
      </Link>
      {!isSelf && (
        <Button
          variant={isActive ? "ghost" : "secondary"}
          size="sm"
          onClick={handleToggle}
          disabled={isPending}
        >
          {isActive ? "Desactivar" : "Activar"}
        </Button>
      )}
    </div>
  );
}
