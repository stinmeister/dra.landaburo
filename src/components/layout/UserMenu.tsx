'use client';
// Client Component — auth state no está disponible server-side en el Header.
// Usa el browser client de Supabase + onAuthStateChange para que el avatar
// aparezca/desaparezca inmediatamente tras sign-in/sign-out sin reload completo.
// Además de la sesión, lee profiles.role para mostrar links contextuales:
//   admin       → Panel de Control (/dashboard/ejecutivo)
//   staff       → Panel Operativo  (/dashboard/operativo)
//   paciente    → solo Mi Portal   (/portal/paciente)
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import styles from './UserMenu.module.css';

type Role = 'admin' | 'medico' | 'operativo' | 'cosmetologa' | 'paciente';

const ROLE_LABELS: Record<Role, string> = {
  admin:       'Administrador',
  medico:      'Médico/a',
  operativo:   'Operativo/a',
  cosmetologa: 'Cosmetóloga',
  paciente:    'Paciente',
};

async function fetchProfile(userId: string): Promise<{ fullName: string; role: Role }> {
  const supabase = createClient();
  const { data } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', userId)
    .single();
  return {
    fullName: (data?.full_name as string | undefined) ?? '',
    role: ((data?.role as Role | undefined) ?? 'paciente'),
  };
}

export default function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('paciente');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
      if (!u) return;
      // Fallback inmediato con metadata de auth mientras carga el profile
      const fallback = (u.user_metadata?.full_name as string | undefined) ?? u.email ?? '';
      setFullName(fallback);
      const profile = await fetchProfile(u.id);
      if (profile.fullName) setFullName(profile.fullName);
      setRole(profile.role);
    }
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const fallback = (u.user_metadata?.full_name as string | undefined) ?? u.email ?? '';
        setFullName(fallback);
        const profile = await fetchProfile(u.id);
        if (profile.fullName) setFullName(profile.fullName);
        setRole(profile.role);
      } else {
        setFullName('');
        setRole('paciente');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
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

  const initial = fullName.trim().charAt(0).toUpperCase() || '?';
  const isAdmin = role === 'admin';
  const isStaff = role === 'medico' || role === 'operativo' || role === 'cosmetologa';

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
          <div className={styles.dropdownHeader}>
            <p className={styles.dropdownName}>{fullName}</p>
            <span className={styles.dropdownBadge}>{ROLE_LABELS[role]}</span>
          </div>

          {isAdmin && (
            <Link
              href="/dashboard/ejecutivo"
              className={styles.dropdownItem}
              onClick={() => setDropdownOpen(false)}
              role="menuitem"
            >
              Panel de Control
            </Link>
          )}

          {isStaff && (
            <Link
              href="/dashboard/operativo"
              className={styles.dropdownItem}
              onClick={() => setDropdownOpen(false)}
              role="menuitem"
            >
              Panel Operativo
            </Link>
          )}

          <Link
            href="/portal/paciente"
            className={styles.dropdownItem}
            onClick={() => setDropdownOpen(false)}
            role="menuitem"
          >
            Mi Portal
          </Link>

          <button
            onClick={handleSignOut}
            className={`${styles.dropdownItem} ${styles.dropdownSignOut}`}
            role="menuitem"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
