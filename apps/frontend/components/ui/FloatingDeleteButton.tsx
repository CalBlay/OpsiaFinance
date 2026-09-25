"use client";

import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";

interface FloatingDeleteButtonProps {
  onClick: () => void;
  className?: string;
  label?: string;
}

/** FAB d'eliminació — icona Trash2 (estàndard Dades) i color corporatiu danger. */
export function FloatingDeleteButton({
  onClick,
  className,
  label = "Eliminar",
}: FloatingDeleteButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-28",
        "h-14 w-14 rounded-full",
        "bg-[var(--opsia-ui-danger)] text-white",
        "shadow-xl flex items-center justify-center",
        "hover:brightness-95 active:scale-95",
        "transition-all duration-150 cursor-pointer z-50",
        className
      )}
    >
      <Trash2 className="h-6 w-6" strokeWidth={1.75} />
    </button>
  );
}
