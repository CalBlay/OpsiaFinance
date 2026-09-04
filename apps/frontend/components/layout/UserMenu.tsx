"use client";

import { getInitials } from "@/lib/utils";
import { KeyRound, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import styles from "./UserMenu.module.css";

interface UserMenuProps {
  name: string;
  role: string;
}

export function UserMenu({ name, role: _role }: UserMenuProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.avatar} title={name}>
        {getInitials(name)}
      </div>
      <Link
        href="/compte/contrasenya"
        className={styles.iconBtn}
        aria-label="Canviar contrasenya"
        title="Canviar contrasenya"
      >
        <KeyRound size={14} strokeWidth={2} />
      </Link>
      <button
        className={styles.iconBtn}
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        aria-label="Tancar sessió"
        title="Tancar sessió"
      >
        <LogOut size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
