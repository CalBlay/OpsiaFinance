"use client";

import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { eliminarImportAction } from "./[id]/actions";

export function ImportRowActions({ importId }: { importId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleClick() {
    if (!confirm("S'eliminarà la importació i el fitxer. Continuar?")) return;
    setError(null);
    startTransition(async () => {
      const res = await eliminarImportAction(importId, { redirect: false });
      if (!res.ok) {
        setError(res.missatge);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      {error ? (
        <span
          className="text-xs text-[var(--opsia-ui-danger)] max-w-[10rem] truncate"
          title={error}
        >
          {error}
        </span>
      ) : null}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        title={isPending ? "Eliminant…" : "Eliminar importació"}
        className={cn(
          "h-8 w-8 rounded-md flex items-center justify-center",
          "transition-colors disabled:opacity-50",
          "text-muted-foreground hover:text-[var(--opsia-ui-danger)] hover:bg-red-50"
        )}
      >
        <Trash2 size={15} strokeWidth={1.75} />
      </button>
    </div>
  );
}
