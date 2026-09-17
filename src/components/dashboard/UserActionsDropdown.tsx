'use client';

import { useState } from 'react';
import { Key, X, Copy, Check, Mail, Link as LinkIcon } from 'lucide-react';
import { adminSendRecoveryEmail, adminGenerateRecoveryLink } from '@/app/dashboard/usuarios/actions';
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
  const [recoveryUrl, setRecoveryUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSendEmail() {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setRecoveryUrl(null);

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

  async function handleGenerateLink() {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setRecoveryUrl(null);

    try {
      const res = await adminGenerateRecoveryLink(userEmail);
      if (res.success && res.recoveryLink) {
        setRecoveryUrl(res.recoveryLink);
        setSuccessMsg('Enlace de recuperación generado. Podés copiarlo y enviárselo al usuario para que establezca su clave.');
      } else {
        setErrorMsg(res.error || 'No se pudo generar el enlace de recuperación.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function closeModal() {
    setIsOpen(false);
    setErrorMsg(null);
    setSuccessMsg(null);
    setRecoveryUrl(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={styles.actionBtn}
        title="Enviar enlace o recuperar contraseña"
      >
        <Key size={13} />
        <span>Restablecer clave</span>
      </button>

      {isOpen && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Recuperación de Contraseña</h3>
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
                  {recoveryUrl && (
                    <div className={styles.linkBox}>
                      <input
                        type="text"
                        readOnly
                        value={recoveryUrl}
                        className={styles.linkInput}
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy(recoveryUrl)}
                        className={styles.copyBtn}
                      >
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                        {copied ? ' Copiado' : ' Copiar'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Opción 1: Enviar correo de restablecimiento */}
              <div className={styles.section}>
                <label className={styles.sectionTitle}>Opción 1: Enviar correo oficial de restablecimiento</label>
                <p style={{ fontSize: '0.82rem', color: 'var(--color-gris)', margin: '0.25rem 0 0.75rem' }}>
                  El usuario recibirá un correo con el enlace seguro para definir su propia contraseña.
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

              <div className={styles.divider}>
                <span>o</span>
              </div>

              {/* Opción 2: Generar enlace directo para copiar */}
              <div className={styles.section}>
                <label className={styles.sectionTitle}>Opción 2: Generar enlace para compartir</label>
                <p style={{ fontSize: '0.82rem', color: 'var(--color-gris)', margin: '0.25rem 0 0.75rem' }}>
                  Genera un enlace único de un solo uso para que el usuario restablezca su clave (ideal para enviar por WhatsApp).
                </p>
                <button
                  type="button"
                  onClick={handleGenerateLink}
                  disabled={loading}
                  className={styles.linkBtn}
                >
                  <LinkIcon size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                  {loading ? 'Generando...' : 'Generar enlace de un solo uso'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
