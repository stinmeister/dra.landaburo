'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu, ShoppingBag } from 'lucide-react';
import styles from './Header.module.css';
import { navigation } from '@/data/navigation';
import MobileMenu from './MobileMenu';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Only Home has a guaranteed dark hero — all other pages use dark text from the start
  const hasDarkHero = pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const headerClasses = [
    styles.header,
    scrolled ? styles.scrolled : '',
    !hasDarkHero ? styles.lightPage : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <header className={headerClasses}>
        <div className={styles.container}>
          {/* Columna izquierda: Logo */}
          <Link href="/" className={styles.logo}>
            Dra. Landaburo
          </Link>

          {/* Columna central: Navegación */}
          <nav className={styles.desktopNav}>
            {navigation.map((item) => {
              if (item.children) {
                return (
                  <div key={item.label} className={styles.dropdownContainer}>
                    <Link href={item.href} className={styles.dropdownButton}>
                      {item.label}
                      <ChevronDown size={16} />
                    </Link>
                    <div className={styles.dropdownMenu}>
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={styles.dropdownItem}
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
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Columna derecha: CTA + Carrito + Burger mobile */}
          <div className={styles.headerRight}>
            <Link href="/contacto" className={styles.ctaBtn}>
              Agendar consulta
            </Link>
            <button className={styles.cartBtn} aria-label="Carrito">
              <ShoppingBag size={20} />
            </button>
            <button
              className={styles.mobileMenuBtn}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Menu"
            >
              <Menu size={26} />
            </button>
          </div>
        </div>
      </header>

      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={closeMobileMenu}
      />
    </>
  );
}
