"use client";

import { cn } from "@/lib/utils";
import { Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { eliminarImportAction } from "./[id]/actions";

export function ImportRowActions({ importId }: { importId: string }) {
  const [confirm, setConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    startTransition(async () => {
      await eliminarImportAction(importId, { redirect: false });
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      {confirm && !isPending && (
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
        >
          Cancel·lar
        </button>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        title={confirm ? "Confirma l'eliminació" : "Eliminar importació"}
        className={cn(
          "h-8 w-8 rounded-md flex items-center justify-center",
          "transition-colors disabled:opacity-50",
          confirm
            ? "bg-red-100 text-red-700 hover:bg-red-200"
            : "text-muted-foreground hover:text-red-600 hover:bg-red-50"
        )}
      >
        <Trash size={15} />
      </button>
    </div>
  );
}
