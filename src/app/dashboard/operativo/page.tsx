// Dashboard Operativo — acceso para roles `admin`, `medico`, `operativo`, `cosmetologa`.
// Lee tareas del día desde staff_tasks (reemplaza employee_tasks que estaba roto).
// Personaliza la vista según el nombre del usuario logueado.
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import TaskList from '@/components/dashboard/TaskList';
import type { TaskItem } from '@/components/dashboard/TaskList';
import TreatmentSearch from '@/components/dashboard/TreatmentSearch';
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
        {/* Left column: tasks + search */}
        <div className={styles.leftCol}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Tareas del día</h2>
            <TaskList tasks={tasks} />
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Buscador de tratamientos</h2>
            <p className={styles.cardHelper}>102 tratamientos disponibles — escribí para filtrar</p>
            <TreatmentSearch />
          </section>
        </div>

        {/* Right column: guides */}
        <div className={styles.rightCol}>
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
