// Dashboard Operativo — acceso para roles `admin`, `medico`, `operativo`, `cosmetologa`.
// Lee tareas del día desde staff_tasks (reemplaza employee_tasks que estaba roto).
// Personaliza la vista según el nombre del usuario logueado.
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import TaskList from '@/components/dashboard/TaskList';
import type { TaskItem } from '@/components/dashboard/TaskList';
import TreatmentSearch from '@/components/dashboard/TreatmentSearch';
import ConfiguracionOperativa from '@/components/dashboard/ConfiguracionOperativa';
import CampanasWidget from '@/components/dashboard/CampanasWidget';
import KioskAdmissionsList from '@/components/dashboard/KioskAdmissionsList';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Dashboard Operativo | Dra. Landaburo',
};

const ALLOWED_ROLES = ['admin', 'medico', 'operativo', 'cosmetologa'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

function isAllowed(role: string): role is AllowedRole {
  return (ALLOWED_ROLES as readonly string[]).includes(role);
}

// Guías de personal — Doris eliminada, solo Ceci y Laura
const guides = [
  {
    name: 'Ceci',
    role: 'Cosmiatría & Fidelización de Pacientes',
    items: [
      'Control de stock de cremas e insumos de cabina (los viernes)',
      'Descarga de datos de Calu y actualización de Base Unificada (último día hábil del mes)',
      'Envío de saludos de cumpleaños según guía Drive (ver tareas del día)',
      'Solicitar reseña en Google Maps al finalizar cada atención',
      'Seguimiento de pacientes con cremas por agotarse',
    ],
  },
  {
    name: 'Laura',
    role: 'Calidad & Experiencia del Paciente',
    items: [
      'Evaluación mensual de la experiencia del paciente',
      'Revisión y respuesta a reseñas en Google Maps',
      'Registro de sugerencias y quejas para reporte semanal',
      'Auditoría de presentación del consultorio',
    ],
  },
];

export default async function OperativoDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single<{ id: string; role: string; full_name: string | null }>();

  if (!profile || !isAllowed(profile.role)) redirect('/');

  // Fecha de hoy en zona horaria Argentina
  const todayAR = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date()); // 'YYYY-MM-DD'

  // Read from staff_tasks (new table) — falls back to empty array if table doesn't exist yet
  let tasks: TaskItem[] = [];
  try {
    let query = supabase
      .from('staff_tasks')
      .select('id, title, description, status')
      .eq('due_date', todayAR)
      .eq('status', 'pendiente')
      .order('task_type', { ascending: true });

    if (profile.role !== 'admin') {
      query = query.eq('assigned_profile_id', profile.id);
    }

    const { data: tasksRaw } = await query;

    tasks = (tasksRaw ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description ?? null,
      is_completed: t.status === 'completada',
    }));
  } catch {
    // Table may not exist yet — show empty gracefully
    tasks = [];
  }

  // Load staff profiles for assignment configuration
  const { data: staffProfilesRaw } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['admin', 'medico', 'operativo', 'cosmetologa'])
    .order('full_name', { ascending: true });

  const staffProfiles = staffProfilesRaw ?? [];

  // Query low stock products (<= min_stock_alert or 5 units)
  let lowStockProducts: Array<{ id: string; name: string; category: string; stock_quantity: number; min_stock_alert?: number }> = [];
  try {
    let prodData: any = null;
    const { data: pDataAlert, error: pErr } = await supabase
      .from('products')
      .select('id, name, category, stock_quantity, min_stock_alert')
      .eq('is_active', true)
      .order('stock_quantity', { ascending: true });
    
    if (!pErr && pDataAlert) {
      prodData = pDataAlert;
    } else {
      const { data: pDataFallback } = await supabase
        .from('products')
        .select('id, name, category, stock_quantity')
        .eq('is_active', true)
        .order('stock_quantity', { ascending: true });
      prodData = pDataFallback;
    }
    lowStockProducts = (prodData ?? []).filter((p: any) => (p.stock_quantity ?? 0) <= (p.min_stock_alert ?? 5));
  } catch {
    lowStockProducts = [];
  }

  // Query kiosk admissions (recent 15)
  let kioskAdmissions: any[] = [];
  try {
    const { data: kData } = await supabase
      .from('kiosk_admissions')
      .select('id, created_at, full_name, dni, email, phone, city, attribution_channel, referral_name, interests, status')
      .order('created_at', { ascending: false })
      .limit(15);
    kioskAdmissions = kData ?? [];
  } catch {
    kioskAdmissions = [];
  }

  // Query active ad campaigns
  let activeCampaigns: any[] = [];
  try {
    const { data: cData } = await supabase
      .from('ad_campaigns')
      .select('id, title, platform, status, target_treatment, promo_details, suggested_response, ad_copy')
      .eq('status', 'activa')
      .order('created_at', { ascending: false });
    activeCampaigns = cData ?? [];
  } catch {
    activeCampaigns = [];
  }

  // Load app settings for default assignees
  let appSettings: { default_birthday_assignee?: string; default_giftcard_assignee?: string } | null = null;
  try {
    const { data: sData } = await supabase
      .from('app_settings')
      .select('default_birthday_assignee, default_giftcard_assignee')
      .maybeSingle();
    appSettings = sData;
  } catch {
    // ok if table doesn't exist yet
  }

  const dateLabel = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date());

  const firstName = profile.full_name?.split(' ')[0] ?? 'Equipo';

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Hola, {firstName} 👋</h1>
          <span className={styles.date}>{dateLabel}</span>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Left column: kiosk + tasks + search */}
        <div className={styles.leftCol}>
          {/* Kiosk admissions check-ins */}
          <KioskAdmissionsList initialAdmissions={kioskAdmissions} />

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Tareas del día</h2>
            <TaskList tasks={tasks} />
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Control de Stock & Insumos</h2>
            <p className={styles.cardHelper}>Productos con stock en o por debajo del umbral de alerta</p>
            {lowStockProducts.length === 0 ? (
              <p className={styles.stockEmpty}>✨ Todos los productos cuentan con stock suficiente.</p>
            ) : (
              <div className={styles.stockList}>
                {lowStockProducts.map((p) => (
                  <div key={p.id} className={styles.stockItem}>
                    <div>
                      <div className={styles.stockName}>{p.name}</div>
                      <div className={styles.stockCat}>{p.category}</div>
                    </div>
                    <span className={p.stock_quantity === 0 ? styles.stockBadgeLow : styles.stockBadgeLow}>
                      {p.stock_quantity === 0 ? 'Sin stock (0 ud)' : `${p.stock_quantity} ud`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Buscador de tratamientos</h2>
            <p className={styles.cardHelper}>102 tratamientos disponibles — escribí para filtrar</p>
            <TreatmentSearch />
          </section>
        </div>

        {/* Right column: campaigns + guides + operational config */}
        <div className={styles.rightCol}>
          {/* Active Campaigns Widget */}
          <CampanasWidget campaigns={activeCampaigns} />

          {/* Operational Assignment Config for Admins */}
          {profile.role === 'admin' && (
            <ConfiguracionOperativa
              profiles={staffProfiles}
              initialBirthdayAssignee={appSettings?.default_birthday_assignee}
              initialGiftcardAssignee={appSettings?.default_giftcard_assignee}
            />
          )}

          {/* Google Reviews reminder banner */}
          <section className={styles.reviewsBanner}>
            <div className={styles.reviewsIcon}>🌟</div>
            <div className={styles.reviewsContent}>
              <p className={styles.reviewsTitle}>Pedir reseña en Google Maps</p>
              <p className={styles.reviewsText}>
                Al finalizar cada atención, invitá a la paciente a dejar su reseña.
              </p>
            </div>
            <button
              className={styles.reviewsBtn}
              onClick={undefined}
              id="copyReviewLink"
              type="button"
              data-url="https://g.page/r/REEMPLAZAR-CON-PLACE-ID/review"
            >
              Copiar link
            </button>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Guías de personal</h2>
            <div className={styles.guides}>
              {guides.map((guide) => (
                <div key={guide.name} className={styles.guideItem}>
                  <div className={styles.guideHeader}>
                    <span className={styles.guideName}>{guide.name}</span>
                    <span className={styles.guideRole}>{guide.role}</span>
                  </div>
                  <ul className={styles.guideList}>
                    {guide.items.map((item, i) => (
                      <li key={i} className={styles.guideListItem}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
