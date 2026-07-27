"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useActionState } from "react";
import { loginAction } from "./actions";
import styles from "./page.module.css";

export default function LoginPage() {
  const [error, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandOpsia}>Opsia</span>
          <span className={styles.brandFinance}>Finance</span>
        </div>

        <form action={formAction} className={styles.form}>
          {error && <p className={styles.formError}>{error}</p>}

          <Input
            name="email"
            type="email"
            label="Correu electrònic"
            placeholder="nom@empresa.com"
            autoComplete="email"
            required
            disabled={isPending}
          />

          <Input
            name="password"
            type="password"
            label="Contrasenya"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            disabled={isPending}
          />

          <Button type="submit" className="w-full mt-2" size="lg" disabled={isPending}>
            {isPending ? "Entrant..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
