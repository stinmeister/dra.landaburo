'use client';
// Client Component — purely client-side search over the local treatments array.
// No network call needed: the 102 treatments are already imported from
// src/data/treatments.ts which is a static local module.
import { useState } from 'react';
import { treatments } from '@/data/treatments';
import styles from './TreatmentSearch.module.css';

export default function TreatmentSearch() {
  const [query, setQuery] = useState('');

  const filtered =
    query.trim().length >= 2
      ? treatments.filter(
          (t) =>
            t.title.toLowerCase().includes(query.toLowerCase()) ||
            t.category.toLowerCase().includes(query.toLowerCase())
        )
      : [];

  return (
    <div className={styles.container}>
      <div className={styles.inputWrapper}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar tratamiento..."
          className={styles.input}
          aria-label="Buscar tratamiento"
        />
        {query && (
          <button
            className={styles.clearBtn}
            onClick={() => setQuery('')}
            aria-label="Limpiar búsqueda"
          >
            ✕
          </button>
        )}
      </div>

      {query.trim().length >= 2 && (
        <div className={styles.results}>
          {filtered.length === 0 ? (
            <p className={styles.noResults}>
              Sin resultados para &ldquo;{query}&rdquo;
            </p>
          ) : (
            <>
              <p className={styles.resultCount}>
                {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
              </p>
              <ul className={styles.list}>
                {filtered.map((t) => (
                  <li key={t.slug} className={styles.item}>
                    <span className={styles.itemTitle}>{t.title}</span>
                    <span className={styles.itemCategory}>{t.category}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
