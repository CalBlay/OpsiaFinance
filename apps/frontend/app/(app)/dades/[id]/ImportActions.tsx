"use client";

import { Button } from "@/components/ui/Button";
import { FloatingDeleteButton } from "@/components/ui/FloatingDeleteButton";
import type { EstatImport } from "@/types";
import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { eliminarImportAction, processarExcelAction, updateEstatImportAction } from "./actions";

const ESTATS_ACTUALITZABLES: EstatImport[] = ["CLASSIFICAT", "REVISAT", "CONFIRMAT"];

interface ImportActionsProps {
  importId: string;
  estat: EstatImport;
  rutaStorage: string | null;
}

export function ImportActions({ importId, estat, rutaStorage }: ImportActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function executarProcessament() {
    setFeedback(null);
    startTransition(async () => {
      const res = await processarExcelAction(importId);
      setFeedback({ ok: res.ok, msg: res.missatge });
    });
  }

  function handleProcessar() {
    executarProcessament();
  }

  function handleActualitzar() {
    const msg =
      estat === "CONFIRMAT"
        ? "Aquesta importació està confirmada. Actualitzar tornarà a llegir l'Excel i sobreescriurà totes les dades processades (incloses correccions manuals d'import). L'estat passarà a Classificat. Vols continuar?"
        : "Actualitzar tornarà a llegir l'Excel i sobreescriurà les dades processades (incloses correccions manuals d'import). Vols continuar?";
    if (!confirm(msg)) return;
    executarProcessament();
  }

  function handleArxivar() {
    startTransition(() => {
      updateEstatImportAction(importId, "ARXIVAT");
    });
  }

  function handleConfirmar() {
    startTransition(() => {
      updateEstatImportAction(importId, "CONFIRMAT");
    });
  }

  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleEliminar() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startTransition(() => {
      eliminarImportAction(importId);
    });
  }

  const potProcessar = rutaStorage && estat === "PENDENT";
  const potActualitzar = rutaStorage && ESTATS_ACTUALITZABLES.includes(estat);
  const potConfirmar = estat === "CLASSIFICAT" || estat === "REVISAT";
  const potArxivar = estat !== "CONFIRMAT" && estat !== "ARXIVAT";

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          {potProcessar && (
            <Button onClick={handleProcessar} disabled={isPending}>
              {isPending ? "Processant…" : "Processar Excel"}
            </Button>
          )}
          {potActualitzar && (
            <Button variant="outline" onClick={handleActualitzar} disabled={isPending}>
              <RefreshCw size={14} className={isPending ? "animate-spin" : undefined} />
              {isPending ? "Actualitzant…" : "Actualitzar"}
            </Button>
          )}
          {potConfirmar && (
            <Button onClick={handleConfirmar} disabled={isPending}>
              {isPending ? "Guardant…" : "Confirmar importació"}
            </Button>
          )}
          {potArxivar && (
            <Button variant="outline" onClick={handleArxivar} disabled={isPending}>
              Arxivar
            </Button>
          )}
        </div>

        {feedback && (
          <p className={`text-sm ${feedback.ok ? "text-green-700" : "text-destructive"}`}>
            {feedback.msg}
          </p>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setConfirmDelete(false)} />
      )}
      <FloatingDeleteButton
        onClick={handleEliminar}
        label={confirmDelete ? "Confirma l'eliminació" : "Eliminar importació"}
        className={confirmDelete ? "animate-pulse" : ""}
      />
    </>
  );
}
