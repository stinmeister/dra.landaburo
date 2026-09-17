'use client';

import Link from 'next/link';
import styles from './tabs.module.css';

export interface TabItem {
  key: string;
  label: string;
  href: string;
  badge?: number;
}

interface Props {
  tabs: TabItem[];
  activeTab: string;
}

export default function EjecutivoTabs({ tabs, activeTab }: Props) {
  if (tabs.length <= 1) {
    // Si el usuario solo tiene acceso a una pestaña (ej: Ceci con Cierre Diario),
    // no se muestra la barra de pestañas para mantener la vista limpia.
    return null;
  }

  return (
    <nav className={styles.tabsContainer} aria-label="Pestañas de Dashboard Ejecutivo">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ''}`}
          >
            <span>{tab.label}</span>
            {tab.badge != null && tab.badge > 0 && (
              <span className={`${styles.badge} ${isActive ? styles.badgeActive : ''}`}>
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
