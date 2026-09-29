'use client';

import { useState } from 'react';
import { Key, X, Mail } from 'lucide-react';
import { adminSendRecoveryEmail } from '@/app/dashboard/usuarios/actions';
import styles from './UserActionsDropdown.module.css';

interface Props {
  userId: string;
  userName: string;
  userEmail: string;
}

export default function UserActionsDropdown({ userId, userName, userEmail }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSendEmail() {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await adminSendRecoveryEmail(userEmail);
      if (res.success) {
        setSuccessMsg(`Correo de recuperación enviado exitosamente a ${userEmail}.`);
      } else {
        setErrorMsg(res.error || 'Error al enviar el correo de recuperación.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  function closeModal() {
    setIsOpen(false);
    setErrorMsg(null);
    setSuccessMsg(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={styles.actionBtn}
        title="Enviar correo de restablecimiento de contraseña"
      >
        <Key size={13} />
        <span>Restablecer clave</span>
      </button>

      {isOpen && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Restablecer Contraseña</h3>
              <button
                type="button"
                onClick={closeModal}
                className={styles.closeBtn}
                aria-label="Cerrar modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.userInfoBox}>
                <span className={styles.userName}>{userName || 'Usuario sin nombre'}</span>
                <span className={styles.userEmail}>{userEmail}</span>
              </div>

              {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}

              {successMsg && (
                <div className={styles.successMessage}>
                  <span>{successMsg}</span>
                </div>
              )}

              <div className={styles.section}>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-gris)', margin: '0.25rem 0 1rem', lineHeight: 1.5 }}>
                  Por política estricta de seguridad, los administradores no pueden definir contraseñas. Al presionar el botón, el usuario recibirá un correo electrónico con un enlace seguro oficial de Supabase Auth para configurar su clave.
                </p>
                <button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={loading}
                  className={styles.savePasswordBtn}
                >
                  <Mail size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                  {loading ? 'Enviando correo...' : 'Enviar correo al usuario'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
