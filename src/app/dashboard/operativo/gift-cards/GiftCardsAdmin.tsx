'use client';

import { useState } from 'react';
import styles from './gift-cards.module.css';

interface GiftCardResult {
  id: string;
  code: string;
  amount_ars: number;
  remaining_balance_ars: number;
  status: string;
  expiration_date: string;
  sender_name: string;
  sender_email: string;
  recipient_name: string | null;
  dedication: string | null;
}

export default function GiftCardsAdminPage() {
  const [searchCode, setSearchCode] = useState('');
  const [card, setCard] = useState<GiftCardResult | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);

  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemNote, setRedeemNote] = useState('');
  const [redeemError, setRedeemError] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState('');

  const formatARS = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = searchCode.trim().toUpperCase();
    if (!code) return;
    setSearching(true);
    setSearchError('');
    setCard(null);
    setRedeemAmount('');
    setRedeemSuccess('');
    setRedeemError('');
    try {
      const res = await fetch(`/api/gift-cards/lookup?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) { setSearchError(data.error || 'No se encontró ninguna gift card con ese código.'); return; }
      setCard(data);
    } catch {
      setSearchError('Error de conexión.');
    } finally {
      setSearching(false);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!card) return;
    const amount = parseFloat(redeemAmount);
    if (!amount || amount <= 0) { setRedeemError('Ingresá un monto a descontar.'); return; }
    if (amount > card.remaining_balance_ars) {
      setRedeemError(`El saldo disponible es ${formatARS(card.remaining_balance_ars)}. Ingresá un monto igual o menor.`);
      return;
    }
    setRedeemError('');
    setRedeemLoading(true);
    try {
      const res = await fetch('/api/gift-cards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: card.code, amount_to_redeem: amount, notes: redeemNote.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { setRedeemError(data.error || 'Error al aplicar el canje.'); return; }
      setRedeemSuccess(`✓ Canje aplicado correctamente. Saldo restante: ${formatARS(data.remaining_balance_ars)}.`);
      setCard((prev) => prev ? { ...prev, remaining_balance_ars: data.remaining_balance_ars, status: data.status } : null);
      setRedeemAmount('');
      setRedeemNote('');
    } catch {
      setRedeemError('Error de conexión al aplicar el canje.');
    } finally {
      setRedeemLoading(false);
    }
  };

  const statusLabel: Record<string, { label: string; color: string }> = {
    active: { label: 'Activa', color: '#27ae60' },
    partial: { label: 'Con saldo parcial', color: '#f39c12' },
    redeemed: { label: 'Canjeada', color: '#7f8c8d' },
    expired: { label: 'Vencida', color: '#c0392b' },
    pending_payment: { label: 'Pago pendiente', color: '#e67e22' },
    cancelled: { label: 'Cancelada', color: '#c0392b' },
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Gift Cards — Validación y Canje</h1>
        <p className={styles.subtitle}>Buscá por código para validar y aplicar el canje.</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className={styles.searchForm}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="DL-XXXX-XXXX"
          value={searchCode}
          onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
          maxLength={12}
          spellCheck={false}
        />
        <button type="submit" className={styles.searchBtn} disabled={searching}>
          {searching ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {searchError && <p className={styles.errorMsg}>{searchError}</p>}

      {/* Card result */}
      {card && (
        <div className={styles.cardResult}>
          <div className={styles.cardResultHeader}>
            <div>
              <span className={styles.codeDisplay}>{card.code}</span>
              <span
                className={styles.statusBadge}
                style={{ background: statusLabel[card.status]?.color || '#7f8c8d' }}
              >
                {statusLabel[card.status]?.label || card.status}
              </span>
            </div>
            <div className={styles.cardMeta}>
              <span>De: {card.sender_name} ({card.sender_email})</span>
              {card.recipient_name && <span>Para: {card.recipient_name}</span>}
              <span>Vence: {new Date(card.expiration_date).toLocaleDateString('es-AR')}</span>
            </div>
          </div>

          <div className={styles.balanceRow}>
            <div className={styles.balanceItem}>
              <p className={styles.balanceLabel}>Monto Original</p>
              <p className={styles.balanceValue}>{formatARS(card.amount_ars)}</p>
            </div>
            <div className={styles.balanceItem}>
              <p className={styles.balanceLabel}>Saldo Disponible</p>
              <p className={`${styles.balanceValue} ${styles.balanceAvailable}`}>
                {formatARS(card.remaining_balance_ars)}
              </p>
            </div>
          </div>

          {card.dedication && (
            <p className={styles.dedicationDisplay}>&ldquo;{card.dedication}&rdquo;</p>
          )}

          {/* Redeem form — only if card is active or partial */}
          {(card.status === 'active' || card.status === 'partial') && (
            <form onSubmit={handleRedeem} className={styles.redeemForm}>
              <h3 className={styles.redeemTitle}>Aplicar Canje</h3>
              <div className={styles.redeemRow}>
                <div className={styles.redeemField}>
                  <label className={styles.redeemLabel}>Monto a descontar (ARS)</label>
                  <input
                    type="number"
                    className={styles.redeemInput}
                    placeholder="Ej: 15000"
                    min={1}
                    max={card.remaining_balance_ars}
                    step={1}
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(e.target.value)}
                  />
                </div>
                <div className={styles.redeemField}>
                  <label className={styles.redeemLabel}>Tratamiento / nota (opcional)</label>
                  <input
                    type="text"
                    className={styles.redeemInput}
                    placeholder="Ej: Limpieza profunda"
                    value={redeemNote}
                    onChange={(e) => setRedeemNote(e.target.value)}
                  />
                </div>
              </div>
              {redeemError && <p className={styles.errorMsg}>{redeemError}</p>}
              {redeemSuccess && <p className={styles.successMsg}>{redeemSuccess}</p>}
              <button type="submit" className={styles.redeemBtn} disabled={redeemLoading}>
                {redeemLoading ? 'Aplicando...' : 'Confirmar Canje'}
              </button>
            </form>
          )}

          {card.status === 'redeemed' && (
            <p className={styles.redeemedMsg}>✓ Esta gift card ya fue canjeada en su totalidad.</p>
          )}
          {card.status === 'expired' && (
            <p className={styles.expiredMsg}>✗ Esta gift card está vencida y no puede canjearse.</p>
          )}
        </div>
      )}
    </div>
  );
}
