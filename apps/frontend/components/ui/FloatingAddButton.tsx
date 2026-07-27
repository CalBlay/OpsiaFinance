"use client";

import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";

interface FloatingAddButtonProps {
  href?: string;
  onClick?: () => void;
  className?: string;
  label?: string;
}

export function FloatingAddButton({
  href,
  onClick,
  className,
  label = "Afegir",
}: FloatingAddButtonProps) {
  const base = cn(
    "fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 sm:right-10",
    "h-14 w-14 rounded-full",
    "bg-primary text-primary-foreground",
    "shadow-xl flex items-center justify-center",
    "hover:bg-primary/90 active:scale-95",
    "transition-all duration-150 cursor-pointer z-50",
    className
  );

  if (href) {
    return (
      <Link href={href} className={base} aria-label={label}>
        <Plus className="h-7 w-7" strokeWidth={2.2} />
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={base} aria-label={label}>
      <Plus className="h-7 w-7" strokeWidth={2.2} />
    </button>
  );
}
