"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/app/dashboard/layout.module.css";

interface NavItem {
  href: string;
  label: string;
}

export default function DashboardNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className={styles.sidebarNav}>
      {items.map((item) => {
        // Mark active if pathname starts with item.href (covers sub-routes)
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
