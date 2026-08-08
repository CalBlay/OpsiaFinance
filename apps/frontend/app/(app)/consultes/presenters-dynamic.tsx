"use client";

import dynamic from "next/dynamic";

function PresenterFallback() {
  return (
    <output aria-live="polite" style={{ padding: "1.25rem 0", opacity: 0.7 }}>
      Carregant vista…
    </output>
  );
}

/** Presentadors grossos: code-split fora del JS inicial de la ruta. */
export const VendesComparativaPresentacio = dynamic(
  () =>
    import("./vendes-restaurants/VendesPresentacio").then((m) => m.VendesComparativaPresentacio),
  { loading: PresenterFallback }
);

export const VendesRestaurantPresentacio = dynamic(
  () => import("./vendes-restaurants/VendesPresentacio").then((m) => m.VendesRestaurantPresentacio),
  { loading: PresenterFallback }
);

export const CostSalarialPresentacio = dynamic(
  () => import("./cost-salarial/CostSalarialPresentacio").then((m) => m.CostSalarialPresentacio),
  { ssr: false, loading: PresenterFallback }
);

export const CostPersonalPresentacio = dynamic(
  () => import("./cost-personal/CostPersonalPresentacio").then((m) => m.CostPersonalPresentacio),
  { ssr: false, loading: PresenterFallback }
);
