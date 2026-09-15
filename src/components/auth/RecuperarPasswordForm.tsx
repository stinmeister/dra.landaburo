'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from './LoginForm.module.css';

export default function RecuperarPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Por favor ingresá un correo electrónico válido.');
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/actualizar-contrasena`;

    const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    setLoading(false);

    if (authError) {
      setError('Ocurrió un error al procesar la solicitud. Intentá de nuevo más tarde.');
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className={styles.successBox}>
        <h3 className={styles.successTitle}>Revisá tu correo</h3>
        <p className={styles.successText}>
          Si el correo <strong>{email}</strong> está registrado, te enviamos un enlace para restablecer tu contraseña.
        </p>
        <p className={styles.successText}>
          Revisá tu bandeja de entrada y la carpeta de spam o correo no deseado.
        </p>
        <Link href="/login" className={styles.backToLogin}>
          ← Volver a iniciar sesión
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
        <label htmlFor="recovery-email" className={styles.label}>
          Email registrado
        </label>
        <input
          id="recovery-email"
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

      <button
        type="submit"
        className={styles.submitBtn}
        disabled={loading}
      >
        {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
      </button>

      <p className={styles.footerLink}>
        ¿Te acordaste de tu contraseña?{' '}
        <Link href="/login" className={styles.link}>
          Ingresar
        </Link>
      </p>
    </form>
  );
}
