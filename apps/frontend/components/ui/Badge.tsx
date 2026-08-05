import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import type * as React from "react";

/* ─── Badge genèric (idèntic a CalBlaApp) ────────────────────────────────────── */

type BadgeVariant = "default" | "success" | "warning" | "destructive" | "secondary" | "outline";

const BADGE_STYLES: Record<BadgeVariant, string> = {
  default: "bg-secondary text-secondary-foreground",
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  destructive: "bg-red-100 text-red-800",
  secondary: "bg-gray-100 text-gray-700 border border-gray-300",
  outline: "bg-transparent text-foreground border border-border",
};

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: BadgeVariant;
}

export function Badge({ children, className, variant = "default" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        BADGE_STYLES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ─── Badge de rol (OpsiaFinance) ────────────────────────────────────────────── */

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  EDICIO: "Editor",
  CONSULTA: "Consultor",
};

const ROLE_VARIANTS: Record<UserRole, BadgeVariant> = {
  ADMIN: "destructive",
  EDICIO: "warning",
  CONSULTA: "secondary",
};

export function RoleBadge({ role }: { role: UserRole }) {
  return <Badge variant={ROLE_VARIANTS[role]}>{ROLE_LABELS[role]}</Badge>;
}

/* ─── Badge d'estat (OpsiaFinance) ──────────────────────────────────────────── */

export function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge variant={isActive ? "success" : "secondary"}>{isActive ? "Actiu" : "Inactiu"}</Badge>
  );
}

/* ─── Badge d'estat d'importació ─────────────────────────────────────────────── */

import type { EstatImport } from "@/types";

const ESTAT_IMPORT_VARIANTS: Record<EstatImport, BadgeVariant> = {
  PENDENT: "warning",
  CLASSIFICAT: "secondary",
  REVISAT: "outline",
  CONFIRMAT: "success",
  ERROR: "destructive",
  ARXIVAT: "secondary",
};

const ESTAT_IMPORT_LABELS: Record<EstatImport, string> = {
  PENDENT: "Pendent",
  CLASSIFICAT: "Classificat",
  REVISAT: "Revisat",
  CONFIRMAT: "Confirmat",
  ERROR: "Error",
  ARXIVAT: "Arxivat",
};

export function EstatImportBadge({ estat }: { estat: EstatImport }) {
  return <Badge variant={ESTAT_IMPORT_VARIANTS[estat]}>{ESTAT_IMPORT_LABELS[estat]}</Badge>;
}
