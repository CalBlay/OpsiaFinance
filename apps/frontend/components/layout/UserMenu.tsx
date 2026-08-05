"use client";

import { getInitials } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
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
      <button
        className={styles.logoutBtn}
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
