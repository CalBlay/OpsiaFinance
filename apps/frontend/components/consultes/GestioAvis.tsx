import type { InfoGestioConsulta } from "@/lib/repartiment/info-gestio";
import type { VistaCompte } from "@/lib/vista-compte";
import { vistaInclouRepartiment } from "@/lib/vista-compte";
import Link from "next/link";
import styles from "./GestioAvis.module.css";

export function GestioAvis({
  vista = "gestio",
  info,
}: {
  vista?: VistaCompte;
  info: InfoGestioConsulta | null;
}) {
  if (!vistaInclouRepartiment(vista) || !info) return null;

  if (info.enReconstruccio) {
    return (
      <output className={styles.avísWarn}>
        <strong>Repartiment desactivat.</strong> S’han eliminat els càlculs d’estructura a Gestió.
        Ara Gestió = Directe (SAP + ajustos), sense pool / % / personal SC. Tornarem a definir les
        regles des de zero.
      </output>
    );
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

  return null;
}
