"use client";

import { Button } from "@/components/ui/Button";
import { Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { uploadHoresTreballAction } from "./actions";
import styles from "./page.module.css";

export function UploadHoresForm({ canEdit }: { canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; missatge: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!canEdit) return null;

  const submit = () => {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setFeedback({ ok: false, missatge: "Selecciona un fitxer Excel." });
      return;
    }
    const fd = new FormData();
    fd.set("fitxer", file);
    startTransition(async () => {
      const r = await uploadHoresTreballAction(fd);
      setFeedback({ ok: r.ok, missatge: r.missatge });
      if (r.ok && r.periodId) {
        window.location.href = `/dades/traspass-personal/${r.periodId}`;
      }
    });
  };

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Importar excel d&apos;hores</h2>
      <p className={styles.helpText}>
        Nom del fitxer: <strong>Hores Centres de Treball mm_aaaa.xlsx</strong> (p. ex. «Hores
        Centres de Treball 01_2026.xlsx»).
      </p>
      <div className={styles.uploadRow}>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className={styles.fileInput} />
        <Button disabled={pending} onClick={submit}>
          <Upload size={16} />
          {pending ? "Processant…" : "Pujar i processar"}
        </Button>
      </div>
      {feedback && (
        <p className={feedback.ok ? styles.feedbackOk : styles.feedbackErr}>{feedback.missatge}</p>
      )}
    </section>
  );
}

export function PeriodLinkList({
  periods,
}: {
  periods: {
    id: string;
    nom: string;
    execucioTraspassPersonal: { id: string; estat: string } | null;
  }[];
}) {
  if (!periods.length) {
    return <p className={styles.muted}>Encara no hi ha imports d&apos;hores.</p>;
  }

  return (
    <section className={styles.card}>
      {periods.map((p) => (
        <div key={p.id} className={styles.linkRow}>
          <Link href={`/dades/traspass-personal/${p.id}`}>{p.nom}</Link>
          {p.execucioTraspassPersonal ? (
            <span
              className={`${styles.badge} ${
                p.execucioTraspassPersonal.estat === "CONFIRMAT"
                  ? styles.badgeConfirmat
                  : styles.badgeBorrador
              }`}
            >
              {p.execucioTraspassPersonal.estat === "CONFIRMAT" ? "Confirmat" : "Esborrany"}
            </span>
          ) : (
            <span className={styles.muted}>Sense processar</span>
          )}
        </div>
      ))}
    </section>
  );
}
