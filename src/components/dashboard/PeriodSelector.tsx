'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
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
  const prevPeriod = currentIndex > 0 ? options[currentIndex - 1].value : null;
  const nextPeriod =
    currentIndex < options.length - 1 && currentIndex !== -1
      ? options[currentIndex + 1].value
      : null;

  // Agrupar opciones por año (orden descendente de años: 2026, 2025...)
  const groupedByYear = useMemo(() => {
    const groups: Record<string, PeriodOption[]> = {};
    options.forEach((opt) => {
      const year = opt.value.slice(0, 4);
      if (!groups[year]) groups[year] = [];
      groups[year].push(opt);
    });

    const years = Object.keys(groups).sort((a, b) => Number(b) - Number(a));
    return years.map((year) => ({
      year,
      options: groups[year],
    }));
  }, [options]);

  return (
    <div className={styles.container}>
      {prevPeriod ? (
        <Link
          href={`/dashboard/ejecutivo?period=${encodeURIComponent(prevPeriod)}`}
          className={styles.navBtn}
          title="Mes anterior"
          aria-label="Mes anterior"
        >
          ‹
        </Link>
      ) : (
        <span
          className={`${styles.navBtn} ${styles.navBtnDisabled}`}
          title="Mes anterior"
          aria-label="Mes anterior"
          aria-disabled="true"
        >
          ‹
        </span>
      )}

      <span className={styles.label}>Período:</span>

      <select
        value={currentPeriod}
        onChange={(e) => handlePeriodChange(e.target.value)}
        className={styles.select}
        aria-label="Seleccionar período"
      >
        {groupedByYear.map((group) => (
          <optgroup key={group.year} label={`Año ${group.year}`}>
            {group.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} {opt.hasData ? '●' : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {nextPeriod ? (
        <Link
          href={`/dashboard/ejecutivo?period=${encodeURIComponent(nextPeriod)}`}
          className={styles.navBtn}
          title="Mes siguiente"
          aria-label="Mes siguiente"
        >
          ›
        </Link>
      ) : (
        <span
          className={`${styles.navBtn} ${styles.navBtnDisabled}`}
          title="Mes siguiente"
          aria-label="Mes siguiente"
          aria-disabled="true"
        >
          ›
        </span>
      )}
    </div>
  );
}
