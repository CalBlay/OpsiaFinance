import { propostaAjustCentralPctSobreVendesGrup } from "@/lib/ajustos/proposta-central-pct-grup";
import { PropostaCentralPctPanel } from "./PropostaCentralPctPanel";

/** Panell pesat (moltes consultes): es carrega en paral·lel després del shell. */
export async function PropostaCentralPctLoader() {
  try {
    const proposta = await propostaAjustCentralPctSobreVendesGrup(2025, 32.5921);
    if (!proposta) return null;
    return <PropostaCentralPctPanel calc={proposta} />;
  } catch (error) {
    console.error("[dades/ajustos] proposta central pct failed", error);
    return null;
  }
}
