"use server";

import { auth } from "@/lib/auth";
import {
  type BulkImportState,
  type CreateImportState,
  handleBulkImport,
  handleSingleImport,
} from "@/lib/import-upload";

export type { CreateImportState, BulkImportState, BulkFileResult } from "@/lib/import-upload";

export async function createImportAction(
  _prev: CreateImportState,
  formData: FormData
): Promise<CreateImportState> {
  const session = await auth();
  if (!session?.user?.id)
    return { status: "error", message: "No tens permís per fer aquesta acció." };
  try {
    return await handleSingleImport(formData, session.user.id);
  } catch (err) {
    console.error("createImportAction:", err);
    return { status: "error", message: "Error inesperat en pujar el fitxer. Torna-ho a provar." };
  }
}

export async function createImportsBulkAction(
  _prev: BulkImportState,
  formData: FormData
): Promise<BulkImportState> {
  const session = await auth();
  if (!session?.user?.id)
    return { status: "error", message: "No tens permís per fer aquesta acció." };
  try {
    return await handleBulkImport(formData, session.user.id);
  } catch (err) {
    console.error("createImportsBulkAction:", err);
    return { status: "error", message: "Error inesperat en la pujada massiva. Torna-ho a provar." };
  }
}
