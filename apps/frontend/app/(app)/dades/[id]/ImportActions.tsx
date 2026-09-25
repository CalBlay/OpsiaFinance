"use client";

import { Button } from "@/components/ui/Button";
import { FloatingDeleteButton } from "@/components/ui/FloatingDeleteButton";
import type { EstatImport } from "@/types";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { eliminarImportAction, processarExcelAction, updateEstatImportAction } from "./actions";

const ESTATS_ACTUALITZABLES: EstatImport[] = ["CLASSIFICAT", "REVISAT", "CONFIRMAT"];

interface ImportActionsProps {
  importId: string;
  estat: EstatImport;
  rutaStorage: string | null;
  /** Balanç esdeveniments: eliminar també treu ajustos Regularització. */
  esBalancEsdeveniments?: boolean;
}

export function ProcessarExcelButton({
  importId,
  disabled,
}: {
  importId: string;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function handleProcessar() {
    setFeedback(null);
    startTransition(async () => {
      const res = await processarExcelAction(importId);
      setFeedback({ ok: res.ok, msg: res.missatge });
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={handleProcessar} disabled={disabled || isPending}>
        {isPending ? "Processant…" : "Processar Excel"}
      </Button>
      {feedback ? (
        <p className={`text-sm ${feedback.ok ? "text-green-700" : "text-destructive"}`}>
          {feedback.msg}
        </p>
      ) : null}
    </div>
  );
}

export function ImportActions({
  importId,
  estat,
  rutaStorage,
  esBalancEsdeveniments = false,
}: ImportActionsProps) {
  const router = useRouter();
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
    const msg = esBalancEsdeveniments
      ? "Actualitzar tornarà a llegir el balanç i substituirà els ajustos Regularització d'aquests centres/mesos. Vols continuar?"
      : estat === "CONFIRMAT"
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

  function handleEliminar() {
    const msg = esBalancEsdeveniments
      ? "S'eliminarà la importació, el fitxer i els ajustos Regularització d'aquests centres (exercici). Continuar?"
      : "S'eliminarà la importació i el fitxer. Continuar?";
    if (!confirm(msg)) return;

    setFeedback(null);
    startTransition(async () => {
      const res = await eliminarImportAction(importId, { redirect: false });
      if (!res.ok) {
        setFeedback({ ok: false, msg: res.missatge });
        return;
      }
      router.push("/dades");
      router.refresh();
    });
  }

  const potProcessar = estat === "PENDENT";
  const potActualitzar = !!rutaStorage && ESTATS_ACTUALITZABLES.includes(estat);
  const potConfirmar = estat === "CLASSIFICAT" || estat === "REVISAT";
  const potArxivar = estat !== "CONFIRMAT" && estat !== "ARXIVAT";
  const botoProcessar = potProcessar ? (
    <Button onClick={handleProcessar} disabled={isPending}>
      {isPending ? "Processant…" : "Processar Excel"}
    </Button>
  ) : null;

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          {botoProcessar}
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

      <FloatingDeleteButton
        onClick={handleEliminar}
        label={isPending ? "Eliminant…" : "Eliminar importació"}
        className={isPending ? "opacity-60 pointer-events-none" : ""}
      />
    </>
  );
}
