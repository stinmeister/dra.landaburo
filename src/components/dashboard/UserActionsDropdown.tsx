'use client';

import { useState } from 'react';
import { Key, X, Copy, Check, Sparkles, Link as LinkIcon } from 'lucide-react';
import { adminResetUserPassword, adminGenerateRecoveryLink } from '@/app/dashboard/usuarios/actions';
import styles from './UserActionsDropdown.module.css';

interface Props {
  userId: string;
  userName: string;
  userEmail: string;
}

export default function UserActionsDropdown({ userId, userName, userEmail }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recoveryUrl, setRecoveryUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generateSecurePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = 'DL-';
    for (let i = 0; i < 9; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
  }

  async function handleDirectReset(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setErrorMsg('La contraseña debe contener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setRecoveryUrl(null);

    try {
      const res = await adminResetUserPassword(userId, newPassword);
      if (res.success) {
        setSuccessMsg(`Contraseña actualizada con éxito para ${userEmail}.`);
      } else {
        setErrorMsg(res.error || 'Error al restablecer la contraseña.');
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
        setSuccessMsg('Enlace de recuperación generado. Podés copiarlo y enviárselo al usuario.');
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
    setNewPassword('');
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
        title="Blanquear / Restablecer contraseña"
      >
        <Key size={13} />
        <span>Restablecer clave</span>
      </button>

      {isOpen && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Gestión de Contraseña</h3>
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
                  {newPassword && !recoveryUrl && (
                    <div className={styles.linkBox}>
                      <input
                        type="text"
                        readOnly
                        value={newPassword}
                        className={styles.linkInput}
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy(newPassword)}
                        className={styles.copyBtn}
                      >
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                        {copied ? ' Copiado' : ' Copiar'}
                      </button>
                    </div>
                  )}
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

              {/* Opción 1: Fijar contraseña directa */}
              <form onSubmit={handleDirectReset} className={styles.section}>
                <label className={styles.sectionTitle}>Opción 1: Asignar nueva clave directamente</label>
                <div className={styles.inputGroup}>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className={styles.input}
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={generateSecurePassword}
                    className={styles.generateBtn}
                    title="Generar clave aleatoria segura"
                  >
                    <Sparkles size={13} />
                    <span>Generar</span>
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading || !newPassword}
                  className={styles.savePasswordBtn}
                >
                  {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
                </button>
              </form>

              <div className={styles.divider}>
                <span>o</span>
              </div>

              {/* Opción 2: Generar enlace de recuperación */}
              <div className={styles.section}>
                <label className={styles.sectionTitle}>Opción 2: Enlace de recuperación</label>
                <button
                  type="button"
                  onClick={handleGenerateLink}
                  disabled={loading}
                  className={styles.linkBtn}
                >
                  <LinkIcon size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                  {loading ? 'Generando...' : 'Generar enlace de recuperación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
