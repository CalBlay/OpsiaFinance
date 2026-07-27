"use client";

import { Button } from "@/components/ui/Button";
import { Upload } from "lucide-react";
import { useState, useTransition } from "react";
import { importarArbreAction } from "./actions";

export function ImportarArbreButton({ hasData }: { hasData: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleImportar() {
    if (
      hasData &&
      !confirm(
        "Reimportar actualitzarà els noms des del fitxer Excel i afegirà els elements nous. Continuar?"
      )
    )
      return;

    setError(null);
    startTransition(async () => {
      const r = await importarArbreAction();
      if (!r.ok) setError(r.missatge);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" onClick={handleImportar} disabled={isPending}>
        <Upload size={15} />
        {isPending
          ? "Important…"
          : hasData
            ? "Reimportar des del fitxer"
            : "Importar des del fitxer"}
      </Button>
      {error && <span className="text-xs text-destructive max-w-[260px] text-right">{error}</span>}
    </div>
  );
}
