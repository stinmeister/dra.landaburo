'use client';
// Client Component — auth state is not available server-side at header render
// time (the Header is already a Client Component due to scroll/pathname hooks).
// We use the Supabase browser client + onAuthStateChange so the avatar
// appears/disappears immediately after sign-in / sign-out without a full reload.
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import styles from './UserMenu.module.css';

export default function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    // Initial auth state
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      if (u) {
        const name: string =
          (u.user_metadata?.full_name as string | undefined) ?? u.email ?? '';
        setFullName(name);
      }
    });

    // Keep in sync with sign-in / sign-out events from other tabs or the form
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          const name: string =
            (u.user_metadata?.full_name as string | undefined) ?? u.email ?? '';
          setFullName(name);
        } else {
          setFullName('');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setDropdownOpen(false);
    router.push('/');
    router.refresh();
  }

  if (!user) {
    return (
      <Link href="/login" className={styles.loginBtn}>
        Ingresar
      </Link>
    );
  }

  // Show just the first letter of the first word
  const initial = fullName.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        className={styles.avatarBtn}
        onClick={() => setDropdownOpen((prev) => !prev)}
        aria-label="Menú de usuario"
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
      >
        <span className={styles.avatar}>{initial}</span>
      </button>

      {dropdownOpen && (
        <div className={styles.dropdown} role="menu">
          <p className={styles.dropdownName} aria-hidden="true">
            {fullName}
          </p>
          <Link
            href="/portal/paciente"
            className={styles.dropdownItem}
            onClick={() => setDropdownOpen(false)}
            role="menuitem"
          >
            Mi Perfil
          </Link>
          <button
            onClick={handleSignOut}
            className={styles.dropdownItem}
            role="menuitem"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
