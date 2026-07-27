/** Converteix Decimal de Prisma a number per passar-lo a Client Components. */
export function decimalToNumber(value: { toString(): string } | null | undefined): number | null {
  if (value == null) return null;
  return Number.parseFloat(value.toString());
}
