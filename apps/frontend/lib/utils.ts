import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina classes Tailwind resolent conflictes (via tailwind-merge) i
 * filtrant valors buits/falsos (via clsx). Idèntica a CalBlaApp.
 *
 * @example cn("px-4 py-2", isActive && "bg-primary", className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formata una data a format llarg en català.
 * @example formatDate(new Date()) → "1 de juliol de 2026"
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ca-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Formata una data en format curt corporatiu: dd/mm/aaaa.
 * @example formatDateShort(new Date()) → "01/07/2026"
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ca-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Formata un import monetari en euros.
 * @example formatCurrency(1234.5) → "1.234,50 €"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ca-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/**
 * Formata un número per a taules financeres (sense símbol de moneda).
 * @example formatNum(1234.5) → "1.235"  ·  formatNum(1234.5, 2) → "1.234,50"
 */
export function formatNum(amount: number, decimals = 0): string {
  return new Intl.NumberFormat("ca-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Com formatNum, però sempre amb signe explícit (+ / −) per evitar confusió.
 * @example formatNumSigned(136.2, 2) → "+136,20"  ·  formatNumSigned(-136.2, 2) → "-136,20"
 */
export function formatNumSigned(amount: number, decimals = 0): string {
  return new Intl.NumberFormat("ca-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: "exceptZero",
  }).format(amount);
}

/**
 * Retorna les inicials d'un nom complet (màx. 2 caràcters).
 * @example getInitials("Anna Garcia") → "AG"
 */
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
