import { redirect } from "next/navigation";

/** Redirecció: el personal SC ara és la pantalla principal de Repartiment. */
export default function RepartimentPersonalRedirect() {
  redirect("/settings/repartiment");
}
