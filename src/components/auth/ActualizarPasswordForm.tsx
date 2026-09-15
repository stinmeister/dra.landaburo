'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from './LoginForm.module.css';

type Role = 'admin' | 'medico' | 'operativo' | 'cosmetologa' | 'paciente';

function getRedirectByRole(role: Role): string {
  switch (role) {
    case 'admin':
      return '/dashboard/ejecutivo';
    case 'medico':
    case 'operativo':
    case 'cosmetologa':
      return '/dashboard/operativo';
    case 'paciente':
      return '/portal/paciente';
    default:
      return '/';
  }
}

export default function ActualizarPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setHasSession(!!user);
      setCheckingSession(false);
    }

    checkAuth();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!password || password.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden. Verificalas e intentá de nuevo.');
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(`No se pudo actualizar la contraseña: ${updateError.message}`);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    // Get user profile to determine redirect
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let redirectPath = '/dashboard/ejecutivo';
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role) {
        redirectPath = getRedirectByRole(profile.role as Role);
      }
    }

    setTimeout(() => {
      router.push(redirectPath);
      router.refresh();
    }, 1800);
  }

  if (checkingSession) {
    return (
      <div className={styles.form}>
        <p className={styles.footerLink}>Verificando enlace de seguridad...</p>
      </div>
    );
  }

  if (!hasSession && !success) {
    return (
      <div className={styles.errorBanner}>
        <p>
          El enlace de recuperación es inválido o ha expirado.
        </p>
        <div style={{ marginTop: '1rem' }}>
          <Link href="/recuperar-contrasena" className={styles.link}>
            Solicitar un nuevo enlace
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className={styles.successBox}>
        <h3 className={styles.successTitle}>¡Contraseña actualizada!</h3>
        <p className={styles.successText}>
          Tu clave ha sido modificada con éxito. Redirigiéndote al panel...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      <div className={styles.field}>
        <label htmlFor="new-password" className={styles.label}>
          Nueva Contraseña
        </label>
        <input
          id="new-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={styles.input}
          placeholder="Mínimo 8 caracteres"
          required
          autoComplete="new-password"
          minLength={8}
          disabled={loading}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="confirm-password" className={styles.label}>
          Confirmar Nueva Contraseña
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={styles.input}
          placeholder="Repetí tu nueva contraseña"
          required
          autoComplete="new-password"
          minLength={8}
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        className={styles.submitBtn}
        disabled={loading}
      >
        {loading ? 'Guardando...' : 'Establecer nueva contraseña'}
      </button>
    </form>
  );
}
