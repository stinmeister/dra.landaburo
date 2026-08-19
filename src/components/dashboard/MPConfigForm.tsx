'use client';
// MPConfigForm — formulario para configurar las credenciales de MercadoPago.
// Hace upsert en la tabla app_settings (id='default' es el único registro).
// Solo accesible desde el dashboard admin — no exponer a roles menores.
// El access_token es un secret sensible: no se loguea, no se muestra completo.
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './MPConfigForm.module.css';

interface MPSettings {
  mp_access_token: string;
  mp_public_key: string;
  mp_webhook_secret: string;
}

export default function MPConfigForm() {
  const [form, setForm] = useState<MPSettings>({
    mp_access_token: '',
    mp_public_key: '',
    mp_webhook_secret: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Cargar configuración existente al montar
  useEffect(() => {
    (async () => {
      const { data, error: fetchError } = await supabase
        .from('app_settings')
        .select('mp_access_token, mp_public_key, mp_webhook_secret')
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows found — es OK si todavía no hay config
        console.error('[MPConfigForm] Error cargando app_settings:', fetchError);
      }

      if (data) {
        setForm({
          mp_access_token: data.mp_access_token ?? '',
          mp_public_key: data.mp_public_key ?? '',
          mp_webhook_secret: data.mp_webhook_secret ?? '',
        });
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setSuccess(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.mp_access_token.trim()) {
      setError('El Access Token de MercadoPago es obligatorio.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);

    // Upsert: id='default' es la fila única de configuración global
    const { error: upsertError } = await supabase
      .from('app_settings')
      .upsert(
        {
          id: 'default',
          mp_access_token: form.mp_access_token.trim(),
          mp_public_key: form.mp_public_key.trim() || null,
          mp_webhook_secret: form.mp_webhook_secret.trim() || null,
        },
        { onConflict: 'id' }
      );

    if (upsertError) {
      console.error('[MPConfigForm] Error guardando:', upsertError);
      setError('No se pudo guardar la configuración. Intentá de nuevo.');
    } else {
      setSuccess(true);
    }
    setSaving(false);
  };

  if (loading) {
    return <p className={styles.loading}>Cargando configuración...</p>;
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Configuración de MercadoPago</h2>
      <p className={styles.description}>
        Ingresá las credenciales de tu cuenta de MercadoPago para habilitar el
        checkout en la tienda. Encontrás estas claves en{' '}
        <a
          href="https://www.mercadopago.com.ar/developers/panel"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.externalLink}
        >
          tu panel de desarrollador MP
        </a>
        .
      </p>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.fieldGroup}>
          <label htmlFor="mp_access_token" className={styles.label}>
            Access Token *
          </label>
          <input
            id="mp_access_token"
            name="mp_access_token"
            type="password"
            className={styles.input}
            value={form.mp_access_token}
            onChange={handleChange}
            autoComplete="off"
            placeholder="APP_USR-..."
            required
          />
          <p className={styles.hint}>
            Clave secreta — nunca la compartas. Empieza con APP_USR- (producción) o TEST-.
          </p>
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="mp_public_key" className={styles.label}>
            Public Key
          </label>
          <input
            id="mp_public_key"
            name="mp_public_key"
            type="text"
            className={styles.input}
            value={form.mp_public_key}
            onChange={handleChange}
            autoComplete="off"
            placeholder="APP_USR-..."
          />
          <p className={styles.hint}>
            Clave pública (opcional para integración básica con redirect).
          </p>
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="mp_webhook_secret" className={styles.label}>
            Webhook Secret
          </label>
          <input
            id="mp_webhook_secret"
            name="mp_webhook_secret"
            type="password"
            className={styles.input}
            value={form.mp_webhook_secret}
            onChange={handleChange}
            autoComplete="off"
            placeholder="Secret para verificar firmas..."
          />
          <p className={styles.hint}>
            Recomendado para producción. Configuralo en MP → Tus integraciones → Webhooks.
            URL del webhook:{' '}
            <code className={styles.code}>/api/webhook/mercadopago</code>
          </p>
        </div>

        {error && <p className={styles.errorMsg}>{error}</p>}
        {success && (
          <p className={styles.successMsg}>
            Configuración guardada correctamente.
          </p>
        )}

        <button type="submit" className={styles.submitBtn} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </form>
    </section>
  );
}
