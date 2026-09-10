'use client';

import { useState, useTransition } from 'react';
import { saveCampaign, deleteCampaign, toggleCampaignStatus } from './actions';
import styles from './page.module.css';

export interface Campaign {
  id: string;
  title: string;
  platform: string;
  status: 'activa' | 'pausada' | 'finalizada';
  ad_copy: string | null;
  target_treatment: string | null;
  promo_details: string | null;
  suggested_response: string | null;
  start_date: string | null;
  end_date: string | null;
  utm_campaign: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

interface Props {
  initialCampaigns: Campaign[];
  isAdmin: boolean;
}

export default function CampanasClient({ initialCampaigns, isAdmin }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpenNew = () => {
    setEditingCampaign(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (c: Campaign) => {
    setEditingCampaign(c);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingCampaign(null);
  };

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'activa' ? 'pausada' : 'activa';
    startTransition(async () => {
      try {
        await toggleCampaignStatus(id, nextStatus as any);
        setCampaigns((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: nextStatus as any } : c))
        );
      } catch (err: any) {
        alert(err.message || 'Error al cambiar estado');
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('¿Seguro que deseás eliminar esta campaña?')) return;
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append('id', id);
        await deleteCampaign(fd);
        setCampaigns((prev) => prev.filter((c) => c.id !== id));
      } catch (err: any) {
        alert(err.message || 'Error al eliminar');
      }
    });
  };

  // Sort: active first, then paused, then finished
  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const priority = { activa: 0, pausada: 1, finalizada: 2 };
    return (priority[a.status] ?? 3) - (priority[b.status] ?? 3);
  });

  const activeCount = campaigns.filter((c) => c.status === 'activa').length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Campañas Publicitarias</h1>
          <p className={styles.subtitle}>
            {activeCount} campaña{activeCount !== 1 ? 's' : ''} activa{activeCount !== 1 ? 's' : ''} · {campaigns.length} total
          </p>
        </div>
        {isAdmin && (
          <button type="button" onClick={handleOpenNew} className={styles.newBtn}>
            + Nueva Campaña
          </button>
        )}
      </div>

      <div className={styles.infoBox}>
        💡 <strong>Guía para el equipo:</strong> En esta sección podés consultar en tiempo real qué anuncios y promociones están corriendo en redes sociales, qué promesa se le hace al paciente y cómo responder rápidamente ante consultas telefónicas o por WhatsApp.
      </div>

      {sortedCampaigns.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No hay campañas publicitarias registradas.</p>
          {isAdmin && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
              Hacé clic en &quot;+ Nueva Campaña&quot; para registrar la primera pauta activa.
            </p>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {sortedCampaigns.map((c) => (
            <div
              key={c.id}
              className={`${styles.card} ${
                c.status === 'activa'
                  ? styles.cardActive
                  : c.status === 'pausada'
                  ? styles.cardPaused
                  : styles.cardFinished
              }`}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{c.title}</h3>
                <span
                  className={`${styles.badge} ${
                    c.status === 'activa'
                      ? styles.badgeActive
                      : c.status === 'pausada'
                      ? styles.badgePaused
                      : styles.badgeFinished
                  }`}
                >
                  {c.status}
                </span>
              </div>

              <div className={styles.cardMeta}>
                <span className={styles.metaItem}>📱 {c.platform}</span>
                {c.target_treatment && (
                  <span className={styles.metaItem}>✨ {c.target_treatment}</span>
                )}
                {c.start_date && (
                  <span className={styles.metaItem}>
                    📅 Desde {new Date(c.start_date).toLocaleDateString('es-AR')}
                  </span>
                )}
              </div>

              {c.promo_details && (
                <div className={styles.sectionBlock}>
                  <span className={styles.blockLabel}>📌 Aviso destacado</span>
                  <p className={styles.blockText}>{c.promo_details}</p>
                </div>
              )}

              {c.ad_copy && (
                <div className={styles.sectionBlock}>
                  <span className={styles.blockLabel}>📢 Promesa / Texto del anuncio</span>
                  <p className={styles.blockText}>{c.ad_copy}</p>
                </div>
              )}

              {c.suggested_response && (
                <div className={`${styles.sectionBlock} ${styles.responseBlock}`}>
                  <span className={`${styles.blockLabel} ${styles.responseLabel}`}>
                    💬 Respuesta sugerida (WhatsApp / Mostrador)
                  </span>
                  <p className={styles.blockText}>{c.suggested_response}</p>
                </div>
              )}

              {c.notes && (
                <div className={styles.sectionBlock}>
                  <span className={styles.blockLabel}>📝 Notas internas</span>
                  <p className={styles.blockText}>{c.notes}</p>
                </div>
              )}

              {isAdmin && (
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleToggleStatus(c.id, c.status)}
                    className={styles.statusBtn}
                  >
                    {c.status === 'activa' ? 'Pausar' : 'Activar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(c)}
                    className={styles.editBtn}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDelete(c.id)}
                    className={styles.deleteBtn}
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal create / edit */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>
              {editingCampaign ? 'Editar Campaña' : 'Nueva Campaña Publicitaria'}
            </h2>
            <form
              action={async (formData) => {
                try {
                  await saveCampaign(formData);
                  handleCloseModal();
                  window.location.reload();
                } catch (err: any) {
                  alert(err.message || 'Error al guardar');
                }
              }}
            >
              {editingCampaign?.id && (
                <input type="hidden" name="id" value={editingCampaign.id} />
              )}

              <div className={styles.formGrid}>
                <div className={`${styles.field} ${styles.fullCol}`}>
                  <label className={styles.label}>Nombre interno de la campaña *</label>
                  <input
                    name="title"
                    required
                    defaultValue={editingCampaign?.title ?? ''}
                    placeholder="[Nombre interno para identificar la pauta]"
                    className={styles.input}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Plataforma</label>
                  <select
                    name="platform"
                    defaultValue={editingCampaign?.platform ?? 'Meta Ads'}
                    className={styles.select}
                  >
                    <option value="Meta Ads">Meta Ads (Instagram / FB)</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="TikTok Ads">TikTok Ads</option>
                    <option value="Email Marketing">Email Marketing</option>
                    <option value="Otro">Otro canal</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Estado</label>
                  <select
                    name="status"
                    defaultValue={editingCampaign?.status ?? 'activa'}
                    className={styles.select}
                  >
                    <option value="activa">Activa</option>
                    <option value="pausada">Pausada</option>
                    <option value="finalizada">Finalizada</option>
                  </select>
                </div>

                <div className={`${styles.field} ${styles.fullCol}`}>
                  <label className={styles.label}>Tratamiento asociado</label>
                  <input
                    name="target_treatment"
                    defaultValue={editingCampaign?.target_treatment ?? ''}
                    placeholder="[Tratamiento que menciona el anuncio]"
                    className={styles.input}
                  />
                </div>

                <div className={`${styles.field} ${styles.fullCol}`}>
                  <label className={styles.label}>
                    Información destacada del anuncio
                    <span style={{ fontWeight: 400, color: '#848484', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                      (el texto lo redacta ChatGPT contra el Copybook y lo aprueba la Dra. Landaburo)
                    </span>
                  </label>
                  <input
                    name="promo_details"
                    defaultValue={editingCampaign?.promo_details ?? ''}
                    placeholder="[Qué dice el aviso — a completar por Agustín]"
                    className={styles.input}
                  />
                </div>

                <div className={`${styles.field} ${styles.fullCol}`}>
                  <label className={styles.label}>Texto del anuncio (Copy aprobado)</label>
                  <textarea
                    name="ad_copy"
                    rows={3}
                    defaultValue={editingCampaign?.ad_copy ?? ''}
                    placeholder="[Copy aprobado por la Dra. Landaburo — a completar por Agustín]"
                    className={styles.textarea}
                  />
                </div>

                <div className={`${styles.field} ${styles.fullCol}`}>
                  <label className={styles.label}>
                    💬 Respuesta sugerida para WhatsApp / Recepción
                  </label>
                  <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: '#848484' }}>
                    Formato WhatsApp: máx. 4 líneas · máx. 2 emojis (✨ 💫 🌿) · empezar con el nombre de la paciente
                  </p>
                  <textarea
                    name="suggested_response"
                    rows={4}
                    defaultValue={editingCampaign?.suggested_response ?? ''}
                    placeholder="[Qué responder cuando pregunten — a completar por Agustín]"
                    className={styles.textarea}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Fecha Inicio</label>
                  <input
                    type="date"
                    name="start_date"
                    defaultValue={editingCampaign?.start_date ?? ''}
                    className={styles.input}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Fecha Fin (opcional)</label>
                  <input
                    type="date"
                    name="end_date"
                    defaultValue={editingCampaign?.end_date ?? ''}
                    className={styles.input}
                  />
                </div>

                <div className={`${styles.field} ${styles.fullCol}`}>
                  <label className={styles.label}>Notas internas (opcional)</label>
                  <textarea
                    name="notes"
                    rows={2}
                    defaultValue={editingCampaign?.notes ?? ''}
                    placeholder="Detalles sobre presupuesto, segmentación o vigencia..."
                    className={styles.textarea}
                  />
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={styles.cancelModalBtn}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.saveModalBtn}>
                  Guardar Campaña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
