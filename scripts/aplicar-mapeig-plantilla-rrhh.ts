/**
 * Aplica l'auto-mapeig plantilla RRHH (llista seed × Dimensions).
 *
 *   npx tsx scripts/aplicar-mapeig-plantilla-rrhh.ts
 *   npx tsx scripts/aplicar-mapeig-plantilla-rrhh.ts --substituir
 */
import { generarMapeigOrgPlantillaAuto } from "../apps/frontend/lib/rrhh-plantilla/auto-mapeig";

async function main() {
  const substituirTot = process.argv.includes("--substituir");
  const r = await generarMapeigOrgPlantillaAuto({ substituirTot });
  console.log(
    `OK: ${r.creats} nous · ${r.actualitzats} actualitzats · ${r.aplicades.length} aplicades · ${r.senseMatch.length} sense match`
  );
  if (r.aplicades.length) {
    console.log("\nAplicades:");
    for (const p of r.aplicades) {
      const dept = p.departamentNom ? ` / ${p.departamentNom}` : "";
      console.log(
        `  ${p.text} → ${p.centreCodi} · ${p.centreNom}${dept}  (${p.puntuacio} · ${p.motiu})`
      );
    }
  }
  if (r.senseMatch.length) {
    console.log("\nSense match (cal mapa manual):");
    for (const t of r.senseMatch) console.log(`  - ${t}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
