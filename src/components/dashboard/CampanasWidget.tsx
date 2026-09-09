'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './CampanasWidget.module.css';

export interface CampaignSummary {
  id: string;
  title: string;
  platform: string;
  status: string;
  target_treatment: string | null;
  promo_details: string | null;
  suggested_response: string | null;
  ad_copy: string | null;
}

export default function CampanasWidget({ campaigns }: { campaigns: CampaignSummary[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeCampaigns = campaigns.filter((c) => c.status === 'activa');

  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>📢 Campañas Activas en Redes</h2>
          <span className={styles.badge}>{activeCampaigns.length} activa{activeCampaigns.length !== 1 ? 's' : ''}</span>
        </div>
        <Link href="/dashboard/campanas" className={styles.link}>
          Ver todas →
        </Link>
      </div>

      <p className={styles.helper}>
        Promociones y respuestas sugeridas para responder consultas de WhatsApp y teléfono.
      </p>

      {activeCampaigns.length === 0 ? (
        <p className={styles.empty}>No hay campañas publicitarias activas en este momento.</p>
      ) : (
        <div className={styles.list}>
          {activeCampaigns.map((c) => {
            const isExpanded = expandedId === c.id;
            return (
              <div key={c.id} className={styles.item}>
                <div className={styles.itemMain}>
                  <div>
                    <div className={styles.itemTitle}>{c.title}</div>
                    <div className={styles.itemMeta}>
                      <span>{c.platform}</span>
                      {c.target_treatment && <span>· {c.target_treatment}</span>}
                    </div>
                  </div>
                  {c.promo_details && (
                    <span className={styles.promoBadge}>{c.promo_details}</span>
                  )}
                </div>

                {c.suggested_response && (
                  <div className={styles.responseContainer}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      className={styles.toggleResponseBtn}
                    >
                      {isExpanded ? '▲ Ocultar respuesta sugerida' : '💬 Ver respuesta sugerida (WhatsApp)'}
                    </button>
                    {isExpanded && (
                      <div className={styles.responseContent}>
                        <p className={styles.responseText}>{c.suggested_response}</p>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(c.suggested_response || '');
                            alert('Respuesta copiada al portapapeles');
                          }}
                          className={styles.copyBtn}
                        >
                          Copiar texto
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
