'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import styles from './PeriodSelector.module.css';

export interface PeriodOption {
  value: string; // 'YYYY-MM'
  label: string; // e.g. 'Julio 2026'
  hasData?: boolean;
}

interface Props {
  currentPeriod: string; // 'YYYY-MM'
  options: PeriodOption[];
}

export default function PeriodSelector({ currentPeriod, options }: Props) {
  const router = useRouter();

  const handlePeriodChange = (newPeriod: string) => {
    router.push(`/dashboard/ejecutivo?period=${encodeURIComponent(newPeriod)}`);
  };

  const currentIndex = options.findIndex((o) => o.value === currentPeriod);

  const handlePrev = () => {
    // options are usually ordered latest to earliest or earliest to latest
    // Let's assume options are ordered chronologically (earlier -> later)
    if (currentIndex > 0) {
      handlePeriodChange(options[currentIndex - 1].value);
    }
  };

  const handleNext = () => {
    if (currentIndex < options.length - 1 && currentIndex !== -1) {
      handlePeriodChange(options[currentIndex + 1].value);
    }
  };

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={styles.navBtn}
        onClick={handlePrev}
        disabled={currentIndex <= 0}
        title="Mes anterior"
        aria-label="Mes anterior"
      >
        ‹
      </button>

      <span className={styles.label}>Período:</span>

      <select
        value={currentPeriod}
        onChange={(e) => handlePeriodChange(e.target.value)}
        className={styles.select}
        aria-label="Seleccionar período"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label} {opt.hasData ? '●' : ''}
          </option>
        ))}
      </select>

      <button
        type="button"
        className={styles.navBtn}
        onClick={handleNext}
        disabled={currentIndex >= options.length - 1 || currentIndex === -1}
        title="Mes siguiente"
        aria-label="Mes siguiente"
      >
        ›
      </button>
    </div>
  );
}
