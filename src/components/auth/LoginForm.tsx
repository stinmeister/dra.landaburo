'use client';
// Client Component — must run in the browser because it calls the Supabase
// browser client and uses Next.js router for redirect after sign-in.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from './LoginForm.module.css';

type Role = 'admin' | 'medico' | 'operativo' | 'paciente';

function getRedirectByRole(role: Role): string {
  switch (role) {
    case 'admin':
      return '/dashboard/ejecutivo';
    case 'medico':
    case 'operativo':
      return '/dashboard/operativo';
    case 'paciente':
      return '/portal/paciente';
    default:
      return '/';
  }
}

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('Email o contraseña incorrectos. Verificá tus datos e intentá de nuevo.');
      setLoading(false);
      return;
    }

    // Fetch the profile to determine the role and redirect accordingly
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('No se pudo verificar la sesión. Intentá de nuevo.');
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      setError('No se pudo obtener el perfil. Contactá al administrador.');
      setLoading(false);
      return;
    }

    const redirectPath = getRedirectByRole(profile.role as Role);
    router.push(redirectPath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      <div className={styles.field}>
        <label htmlFor="login-email" className={styles.label}>
          Email
        </label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={styles.input}
          placeholder="hola@ejemplo.com"
          required
          autoComplete="email"
          disabled={loading}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="login-password" className={styles.label}>
          Contraseña
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={styles.input}
          placeholder="••••••••"
          required
          autoComplete="current-password"
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        className={styles.submitBtn}
        disabled={loading}
      >
        {loading ? 'Ingresando...' : 'Ingresar'}
      </button>

      <p className={styles.footerLink}>
        ¿No tenés cuenta?{' '}
        <Link href="/registro" className={styles.link}>
          Registrate
        </Link>
      </p>
    </form>
  );
}
