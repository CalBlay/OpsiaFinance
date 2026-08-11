import type { InfoGestioConsulta } from "@/lib/repartiment/info-gestio";
import Link from "next/link";
import styles from "./GestioAvis.module.css";

export function GestioAvis({
  vista,
  info,
}: {
  vista: "directe" | "gestio";
  info: InfoGestioConsulta | null;
}) {
  if (vista !== "gestio" || !info) return null;

  if (info.enReconstruccio) {
    return (
      <output className={styles.avísWarn}>
        <strong>Repartiment desactivat.</strong> S’han eliminat els càlculs d’estructura a Gestió.
        Ara Gestió = Directe (SAP + ajustos), sense pool / % / personal SC. Tornarem a definir les
        regles des de zero.
      </output>
    );
  }

  if (
    info.faseGestioDespeses ||
    info.faseCompres ||
    info.fasePersonalSc ||
    info.faseCompresGestio
  ) {
    const parts: string[] = [];
    if (info.faseGestioDespeses && !info.faseCompres) parts.push("Despeses de gestió");
    else if (info.faseCompres && info.faseGestioDespeses) parts.push("Compres i gestió");
    else if (info.faseCompres) parts.push("Compres");
    else if (info.faseCompresGestio) parts.push("Compres i gestió");
    if (info.fasePersonalSc) parts.push("Personal SC");
    const base = (
      <>
        Fase actual: <strong>{parts.join(" + ")}</strong> sobre Directe (SAP + ajustos). S’hi
        afegeixen els traspassos de treballador confirmats. Confirma a{" "}
        <Link href="/dades/repartiment">Dades → Repartiment</Link>.
      </>
    );
    if (!info.teGestio) {
      return (
        <output className={styles.avísWarn}>
          {base} Sense repartiment confirmat en aquest període, Gestió = Directe.
        </output>
      );
    }
    return <output className={styles.avísInfo}>{base}</output>;
  }

  if (!info.teGestio) {
    return (
      <output className={styles.avísWarn}>
        <strong>Cap repartiment confirmat</strong> per aquest període. La vista Gestió coincideix
        amb Directe fins que confirmis el repartiment a{" "}
        <Link href="/dades/repartiment">Dades → Repartiment</Link> (calcula i confirma cada mes).
      </output>
    );
  }

  if ((info.nomsPendents?.length ?? 0) > 0) {
    return (
      <output className={styles.avísInfo}>
        Repartiment confirmat per <strong>{info.mesosConfirmats}</strong> de{" "}
        <strong>{info.mesosAmbDades}</strong> mesos amb dades.
        {info.nomsPendents.length <= 4 ? (
          <> Sense confirmar: {info.nomsPendents.join(", ")}.</>
        ) : (
          <> {info.nomsPendents.length} mesos encara sense confirmar.</>
        )}
      </output>
    );
  }

  return (
    <output className={styles.avísOk}>
      Repartiment confirmat per tots els mesos del període ({info.mesosConfirmats}).
    </output>
  );
}
