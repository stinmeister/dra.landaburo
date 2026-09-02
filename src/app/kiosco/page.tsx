'use client';

import { useState, useCallback } from 'react';
import styles from './kiosco.module.css';

type Step = 'start' | 'form' | 'success';

const ATTRIBUTION_OPTIONS = [
  { value: 'instagram_organic', label: 'Instagram', icon: '📸', detail: '@dra_landaburo' },
  { value: 'instagram_ad', label: 'Anuncio', icon: '📢', detail: 'Instagram / Facebook Ads' },
  { value: 'google', label: 'Google', icon: '🔍', detail: 'Búsqueda en Google / Sitio Web' },
  { value: 'referral', label: 'Recomendación', icon: '💬', detail: 'Amigo, familiar o paciente' },
  { value: 'walk_in', label: 'Cartel / Paso', icon: '🚶', detail: 'Consultorio o cartel en la calle' },
  { value: 'other', label: 'Otro', icon: '✨', detail: 'Otra fuente' },
];

const INTEREST_OPTIONS = [
  { value: 'armonizacion_facial', label: 'Armonización Facial' },
  { value: 'toxina_botulinica', label: 'Botox' },
  { value: 'acido_hialuronico', label: 'Ácido Hialurónico' },
  { value: 'cosmiatria', label: 'Cosmiatría & Peelings' },
  { value: 'capilar', label: 'Tratamiento Capilar' },
  { value: 'bioestimulacion', label: 'Bioestimulación' },
  { value: 'laser', label: 'Láser & Tecnología' },
  { value: 'otros', label: 'Otros / No sé aún' },
];

interface FormData {
  full_name: string;
  dni: string;
  email: string;
  phone: string;
  birth_date: string;
  attribution_channel: string;
  referral_name: string;
  interests: string[];
  medical_notes: string;
}

export default function KioscoPage() {
  const [step, setStep] = useState<Step>('start');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormData>({
    full_name: '',
    dni: '',
    email: '',
    phone: '',
    birth_date: '',
    attribution_channel: '',
    referral_name: '',
    interests: [],
    medical_notes: '',
  });

  const handleStart = useCallback(() => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    setStep('form');
  }, []);

  const handleInterest = (value: string) => {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(value)
        ? f.interests.filter((i) => i !== value)
        : [...f.interests, value],
    }));
  };

  const handleSubmit = async () => {
    if (!form.full_name || !form.email || !form.phone || !form.attribution_channel) {
      alert('Por favor completá los campos obligatorios: Nombre, Email, Teléfono y Cómo nos conociste.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/kiosco/admision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error('Error al enviar');

      setStep('success');

      setTimeout(() => {
        setForm({
          full_name: '',
          dni: '',
          email: '',
          phone: '',
          birth_date: '',
          attribution_channel: '',
          referral_name: '',
          interests: [],
          medical_notes: '',
        });
        setStep('start');
      }, 8000);
    } catch {
      alert('Hubo un error. Por favor avisá a la recepción.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'start') {
    return (
      <div className={styles.startScreen}>
        <div className={styles.startContent}>
          <div className={styles.logoMark}>DL</div>
          <h1 className={styles.startTitle}>Bienvenida/o al Consultorio</h1>
          <p className={styles.startSubtitle}>
            Dra. Paula Landaburo — Medicina Estética &amp; Dermatología
          </p>
          <p className={styles.startInstruction}>
            Si es tu primera visita, te pedimos que completes un breve formulario para registrar tus datos.
          </p>
          <button onClick={handleStart} className={styles.startBtn}>
            Comenzar Registro
          </button>
          <p className={styles.startNote}>La información es confidencial y segura.</p>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className={styles.successScreen}>
        <div className={styles.successContent}>
          <div className={styles.successCheck}>✓</div>
          <h2 className={styles.successTitle}>¡Registro completado!</h2>
          <p className={styles.successText}>Muchas gracias. En breve te atenderemos.</p>
          <p className={styles.successReset}>La pantalla se reiniciará automáticamente...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formScreen}>
      <div className={styles.formHeader}>
        <span className={styles.formBrand}>Dra. Landaburo</span>
        <span className={styles.formLabel}>Registro de Primera Visita</span>
      </div>

      <div className={styles.formBody}>
        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Tus datos</h2>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Nombre completo *</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Ej: Valentina García"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                autoComplete="off"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>DNI</label>
              <input
                type="text"
                inputMode="numeric"
                className={styles.input}
                placeholder="12345678"
                value={form.dni}
                onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))}
                autoComplete="off"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Email *</label>
              <input
                type="email"
                inputMode="email"
                className={styles.input}
                placeholder="tu@email.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                autoComplete="off"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>WhatsApp / Teléfono *</label>
              <input
                type="tel"
                inputMode="tel"
                className={styles.input}
                placeholder="+54 9 3446 XXXXXX"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                autoComplete="off"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Fecha de nacimiento</label>
              <input
                type="date"
                className={styles.input}
                value={form.birth_date}
                onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
              />
            </div>
          </div>
        </section>

        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>¿Cómo nos conociste? *</h2>
          <div className={styles.attributionGrid}>
            {ATTRIBUTION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.attributionCard} ${
                  form.attribution_channel === opt.value ? styles.selected : ''
                }`}
                onClick={() => setForm((f) => ({ ...f, attribution_channel: opt.value }))}
              >
                <span className={styles.attrIcon}>{opt.icon}</span>
                <span className={styles.attrLabel}>{opt.label}</span>
                <span className={styles.attrDetail}>{opt.detail}</span>
              </button>
            ))}
          </div>
          {form.attribution_channel === 'referral' && (
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>¿Quién te recomendó? (opcional)</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Nombre de la persona"
                value={form.referral_name}
                onChange={(e) => setForm((f) => ({ ...f, referral_name: e.target.value }))}
              />
            </div>
          )}
        </section>

        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>¿Qué tratamientos te interesan?</h2>
          <div className={styles.interestsGrid}>
            {INTEREST_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.interestChip} ${
                  form.interests.includes(opt.value) ? styles.chipSelected : ''
                }`}
                onClick={() => handleInterest(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <div className={styles.formFooter}>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Registrando...' : 'Confirmar Registro →'}
          </button>
          <p className={styles.privacyNote}>
            Tus datos son confidenciales y se utilizan únicamente para mejorar tu experiencia en el consultorio.
          </p>
        </div>
      </div>
    </div>
  );
}
