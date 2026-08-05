"use client";

import { HistorialCarregues } from "@/components/dades/HistorialCarregues";
import type { CarregaFitxerLlistaItem } from "@/lib/carrega-fitxer";
import { deleteCarregaCostSalarialAction, updateNotesCarregaCostAction } from "./actions";

export function HistorialCostSalarial({
  items,
  canEdit,
}: {
  items: CarregaFitxerLlistaItem[];
  canEdit: boolean;
}) {
  return (
    <HistorialCarregues
      items={items}
      canEdit={canEdit}
      onDelete={deleteCarregaCostSalarialAction}
      onSaveNotes={updateNotesCarregaCostAction}
    />
  );
}
