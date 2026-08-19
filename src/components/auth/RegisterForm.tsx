'use client';
// Client Component — handles the sign-up form with client-side Supabase auth.
// After signup, Supabase sends a confirmation email; we don't auto-redirect
// but show a success message prompting the user to check their inbox.
// The `full_name` goes into auth.users.raw_user_meta_data so the DB trigger
// can read it when creating the profiles row.
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from './LoginForm.module.css';

export default function RegisterForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);

    const supabase = createClient();

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (signUpError) {
      // Supabase returns "User already registered" when email is in use
      if (signUpError.message.toLowerCase().includes('already')) {
        setError('Ese email ya está registrado. Intentá ingresar directamente.');
      } else {
        setError('Ocurrió un error al crear tu cuenta. Intentá de nuevo.');
      }
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className={styles.successBox}>
        <p className={styles.successTitle}>¡Cuenta creada!</p>
        <p className={styles.successText}>
          Revisá tu bandeja de entrada para confirmar tu dirección de email y
          activar tu cuenta.
        </p>
        <Link href="/login" className={styles.backToLogin}>
          Volver al inicio de sesión
        </Link>
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
        <label htmlFor="reg-name" className={styles.label}>
          Nombre completo
        </label>
        <input
          id="reg-name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={styles.input}
          placeholder="María García"
          required
          autoComplete="name"
          disabled={loading}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="reg-email" className={styles.label}>
          Email
        </label>
        <input
          id="reg-email"
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
        <label htmlFor="reg-password" className={styles.label}>
          Contraseña
        </label>
        <input
          id="reg-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={styles.input}
          placeholder="Mínimo 8 caracteres"
          required
          minLength={8}
          autoComplete="new-password"
          disabled={loading}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="reg-confirm" className={styles.label}>
          Confirmar contraseña
        </label>
        <input
          id="reg-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={styles.input}
          placeholder="Repetí la contraseña"
          required
          autoComplete="new-password"
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        className={styles.submitBtn}
        disabled={loading}
      >
        {loading ? 'Creando cuenta...' : 'Crear cuenta'}
      </button>

      <p className={styles.footerLink}>
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className={styles.link}>
          Ingresá
        </Link>
      </p>
    </form>
  );
}
