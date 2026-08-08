"use client";

import { useLinkStatus } from "next/link";

/**
 * Marca el Link pare com a pendent via :has([data-link-pending]).
 * Ha d'anar com a fill directe/descendent d'un <Link>.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span data-link-pending="" hidden aria-hidden />;
}
