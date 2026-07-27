import type { InfoGestioConsulta } from "@/lib/repartiment/service";
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

  if (!info.teGestio) {
    return (
      <div className={styles.avísWarn} role="status">
        <strong>Cap repartiment confirmat</strong> per aquest període. La vista Gestió coincideix
        amb Directe fins que confirmis el repartiment a{" "}
        <Link href="/dades/repartiment">Dades → Repartiment</Link> (calcula i confirma cada mes).
      </div>
    );
  }

  if ((info.nomsPendents?.length ?? 0) > 0) {
    return (
      <div className={styles.avísInfo} role="status">
        Repartiment confirmat per <strong>{info.mesosConfirmats}</strong> de{" "}
        <strong>{info.mesosAmbDades}</strong> mesos amb dades.
        {info.nomsPendents.length <= 4 ? (
          <> Sense confirmar: {info.nomsPendents.join(", ")}.</>
        ) : (
          <> {info.nomsPendents.length} mesos encara sense confirmar.</>
        )}
      </div>
    );
  }

  return (
    <div className={styles.avísOk} role="status">
      Repartiment confirmat per tots els mesos del període ({info.mesosConfirmats}).
    </div>
  );
}
