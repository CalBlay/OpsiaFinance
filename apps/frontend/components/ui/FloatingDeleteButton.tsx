"use client";

import { cn } from "@/lib/utils";
import { Trash } from "lucide-react";

interface FloatingDeleteButtonProps {
  onClick: () => void;
  className?: string;
  label?: string;
}

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
        "bg-red-600 text-white",
        "shadow-xl flex items-center justify-center",
        "hover:bg-red-700 active:scale-95",
        "transition-all duration-150 cursor-pointer z-50",
        className
      )}
    >
      <Trash className="h-6 w-6" />
    </button>
  );
}
