import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";
import ui from "./dades-ui.module.css";

type DadesPanelProps = {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Bloc corporatiu (historial / llista) — mateix envolcall a totes les pestanyes. */
export function DadesPanel({ title, meta, children, className }: DadesPanelProps) {
  return (
    <section className={cn(ui.panel, className)}>
      <div className={ui.panelHeader}>
        <h3 className={ui.panelTitle}>{title}</h3>
        {meta != null ? <span className={ui.panelMeta}>{meta}</span> : null}
      </div>
      <div className={ui.panelBody}>{children}</div>
    </section>
  );
}

export function DadesEmpty({
  title,
  text,
  boxed,
}: {
  title?: string;
  text: string;
  boxed?: boolean;
}) {
  if (boxed) {
    return (
      <div className={ui.emptyBox}>
        {title ? <p className={ui.emptyTitle}>{title}</p> : null}
        <p className={ui.emptyText}>{text}</p>
      </div>
    );
  }
  return <p className={ui.empty}>{text}</p>;
}

type IconBtnProps = {
  label: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  children: ReactNode;
};

export function DadesIconBtn({ label, onClick, href, danger, disabled, children }: IconBtnProps) {
  const className = cn(ui.iconBtn, danger && ui.iconDanger);
  if (href) {
    return (
      <Link href={href} className={className} title={label} aria-label={label}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={className}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function DadesNewBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={ui.newBtn} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function DadesBadge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "ok" | "warn" | "muted";
}) {
  return (
    <span
      className={cn(
        ui.badge,
        tone === "ok" && ui.badgeOk,
        tone === "warn" && ui.badgeWarn,
        tone === "muted" && ui.badgeMuted
      )}
    >
      {children}
    </span>
  );
}

export { ui as dadesUi };
