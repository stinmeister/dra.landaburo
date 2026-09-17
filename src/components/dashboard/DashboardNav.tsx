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
        // Mark active if pathname matches base path (ignoring query strings)
        const itemBasePath = item.href.split("?")[0];
        const isActive = pathname === itemBasePath || pathname.startsWith(itemBasePath + "/");
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
