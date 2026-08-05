"use client";

import { HistorialCarregues } from "@/components/dades/HistorialCarregues";
import type { CarregaFitxerLlistaItem } from "@/lib/carrega-fitxer";
import { deleteCarregaVendesAction, updateNotesCarregaVendesAction } from "./actions";

export function HistorialVendes({
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
      onDelete={deleteCarregaVendesAction}
      onSaveNotes={updateNotesCarregaVendesAction}
    />
  );
}
