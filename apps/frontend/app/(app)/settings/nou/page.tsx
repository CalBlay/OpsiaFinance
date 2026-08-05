"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { createUserAction } from "../actions";
import styles from "./page.module.css";

export default function NouUsuariPage() {
  const [error, formAction, isPending] = useActionState(createUserAction, null);

  return (
    <div className={styles.page}>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/settings">
          <ChevronLeft size={14} strokeWidth={2.5} />
          Configuració
        </Link>
      </Button>

      <h1 className={styles.title}>Nou usuari</h1>

      <form action={formAction} className={styles.form}>
        {error && <p className={styles.error}>{error}</p>}

        <Input
          name="name"
          label="Nom complet"
          placeholder="Anna Garcia"
          required
          autoComplete="off"
          disabled={isPending}
        />

        <Input
          name="email"
          type="email"
          label="Correu electrònic"
          placeholder="anna@empresa.com"
          required
          autoComplete="off"
          disabled={isPending}
        />

        <div className={styles.field}>
          <label htmlFor="role" className={styles.label}>
            Rol <span className={styles.required}>*</span>
          </label>
          <select
            id="role"
            name="role"
            className={styles.select}
            defaultValue="CONSULTA"
            disabled={isPending}
          >
            <option value="CONSULTA">Consultor — només lectura</option>
            <option value="EDICIO">Editor — càrrega i edició</option>
            <option value="ADMIN">Administrador — accés complet</option>
          </select>
        </div>

        <div>
          <Input
            name="password"
            type="password"
            label="Contrasenya inicial"
            placeholder="Mínim 8 caràcters"
            required
            minLength={8}
            autoComplete="new-password"
            disabled={isPending}
          />
          <p className={styles.hint}>L'usuari hauria de canviar-la en el primer accés.</p>
        </div>

        <div className={styles.formActions}>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creant..." : "Crear usuari"}
          </Button>
          <Button asChild variant="outline" disabled={isPending}>
            <Link href="/settings">Cancel·lar</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
