'use client';

import React, { useState } from 'react';
import styles from '@/app/contacto/page.module.css';

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    treatment: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar el mensaje');
      }

      setSuccess(data.message || '¡Mensaje enviado con éxito!');
      setFormData({ name: '', email: '', phone: '', treatment: '', message: '' });
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error. Por favor intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      <h2 className={styles.sectionTitle}>Envianos un mensaje</h2>
      
      {success && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(197, 164, 126, 0.15)',
          border: '1px solid var(--color-champagne)',
          borderRadius: '4px',
          color: 'var(--color-negro)',
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
          lineHeight: '1.5'
        }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#ffebee',
          border: '1px solid #ef5350',
          borderRadius: '4px',
          color: '#c62828',
          marginBottom: '1.5rem',
          fontSize: '0.9rem'
        }}>
          {error}
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="name" className={styles.label}>Nombre completo *</label>
          <input
            type="text"
            id="name"
            className={styles.input}
            required
            value={formData.name}
            onChange={handleChange}
            placeholder="Tu nombre y apellido"
          />
        </div>
        
        <div className={styles.formGroup}>
          <label htmlFor="email" className={styles.label}>Email *</label>
          <input
            type="email"
            id="email"
            className={styles.input}
            required
            value={formData.email}
            onChange={handleChange}
            placeholder="ejemplo@correo.com"
          />
        </div>
        
        <div className={styles.formGroup}>
          <label htmlFor="phone" className={styles.label}>Teléfono / WhatsApp</label>
          <input
            type="tel"
            id="phone"
            className={styles.input}
            value={formData.phone}
            onChange={handleChange}
            placeholder="+54 9 11 1234-5678"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="treatment" className={styles.label}>Tratamiento de interés</label>
          <input
            type="text"
            id="treatment"
            className={styles.input}
            value={formData.treatment}
            onChange={handleChange}
            placeholder="Ej: Armonización facial, Toxina botulínica, Consulta médica..."
          />
        </div>
        
        <div className={styles.formGroup}>
          <label htmlFor="message" className={styles.label}>Mensaje *</label>
          <textarea
            id="message"
            rows={5}
            className={styles.textarea}
            required
            value={formData.message}
            onChange={handleChange}
            placeholder="Contanos tus dudas o qué tratamiento te gustaría realizarte..."
          ></textarea>
        </div>
        
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={loading}
          style={{
            display: 'inline-block',
            padding: '1rem 2.5rem',
            backgroundColor: 'var(--color-champagne, #C5A47E)',
            color: 'var(--color-negro, #1C1C1C)',
            fontWeight: 600,
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            transition: 'background-color 0.2s ease',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Enviando mensaje...' : 'Enviar mensaje'}
        </button>
      </form>
    </div>
  );
}
