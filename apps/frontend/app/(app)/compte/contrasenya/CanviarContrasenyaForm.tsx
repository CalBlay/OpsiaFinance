"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { canviarContrasenyaAction } from "./actions";
import styles from "./page.module.css";

export default function CanviarContrasenyaForm() {
  const [error, formAction, isPending] = useActionState(canviarContrasenyaAction, null);
  const searchParams = useSearchParams();
  const ok = searchParams.get("ok") === "1";

  return (
    <div className={styles.page}>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/">
          <ChevronLeft size={14} strokeWidth={2.5} />
          Inici
        </Link>
      </Button>

      <h1 className={styles.title}>Canviar contrasenya</h1>
      <p className={styles.subtitle}>
        Has d&apos;introduir la contrasenya actual per confirmar el canvi.
      </p>

      {ok && !error && (
        <output className={styles.success}>Contrasenya actualitzada correctament.</output>
      )}

      <form action={formAction} className={styles.form}>
        {error && <p className={styles.error}>{error}</p>}

        <Input
          name="actual"
          type="password"
          label="Contrasenya actual"
          autoComplete="current-password"
          required
          disabled={isPending}
        />

        <Input
          name="nova"
          type="password"
          label="Nova contrasenya"
          placeholder="Mínim 8 caràcters"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={isPending}
        />

        <Input
          name="confirmacio"
          type="password"
          label="Confirma la nova contrasenya"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={isPending}
        />

        <div className={styles.formActions}>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Desant..." : "Desar contrasenya"}
          </Button>
          <Button asChild variant="outline" disabled={isPending}>
            <Link href="/">Cancel·lar</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
