import { Suspense } from "react";
import CanviarContrasenyaForm from "./CanviarContrasenyaForm";

export const metadata = { title: "Canviar contrasenya — OpsiaFinance" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CanviarContrasenyaForm />
    </Suspense>
  );
}
