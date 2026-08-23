'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { X, Phone, Mail } from 'lucide-react';
import styles from './MobileMenu.module.css';
import { navigation } from '@/data/navigation';
import { siteContent } from '@/data/site-content';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const pathname = usePathname();

  return (
    <div className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ''}`}>
      <div className={styles.header}>
        <Link href="/" className={styles.logo} onClick={onClose}>
          <Image
            src="/images/cropped-ISO_LOGO-Editado-Editado.png"
            alt="Logo Dra. Landaburo"
            width={30}
            height={30}
            className={styles.logoIcon}
          />
          <div className={styles.logoTextGroup}>
            <span className={styles.logoTitle}>Dra. Landaburo</span>
            <span className={styles.logoSubtitle}>Dermatóloga</span>
          </div>
        </Link>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar menú">
          <X size={28} />
        </button>
      </div>

      <nav className={styles.nav}>
        {navigation.map((item) => {
          if (item.children) {
            return (
              <div key={item.label}>
                <div className={styles.treatmentsTitle}>{item.label}</div>
                <div className={styles.treatmentsList}>
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={styles.treatmentLink}
                      onClick={onClose}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`${styles.navLink} ${pathname === item.href ? styles.navLinkActive : ''}`}
              onClick={onClose}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <div className={styles.contactItem}>
          <Phone size={20} />
          <span>{siteContent.contact.phoneDisplay}</span>
        </div>
        <div className={styles.contactItem}>
          <Mail size={20} />
          <span>{siteContent.contact.email}</span>
        </div>
      </div>
    </div>
  );
}
