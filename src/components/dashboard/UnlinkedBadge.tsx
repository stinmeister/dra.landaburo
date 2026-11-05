import styles from './UnlinkedBadge.module.css';

/**
 * Marca visual sutil "sin vincular" para nombres que vienen de payments.payer_name
 * y todavía no están asociados a una paciente del padrón (FIX-143).
 * Sin hooks: se puede usar desde Server y Client Components.
 */
export default function UnlinkedBadge() {
  return (
    <span
      className={styles.badge}
      data-unlinked-badge="true"
      title="Nombre tomado del cobro: todavía no está vinculado a una paciente del padrón"
    >
      sin vincular
    </span>
  );
}
