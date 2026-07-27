import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import styles from "./ModuleCard.module.css";

interface ModuleCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  variant?: "settings" | "dades";
}

export function ModuleCard({ href, icon: Icon, title, description, variant }: ModuleCardProps) {
  return (
    <Link href={href} className={cn(styles.card, variant && styles[variant])}>
      <div className={styles.iconWrapper} aria-hidden="true">
        <Icon size={30} strokeWidth={1.6} />
      </div>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
    </Link>
  );
}
