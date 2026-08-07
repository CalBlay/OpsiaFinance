import { AppShell } from "@/components/layout/AppShell";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
