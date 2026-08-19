// Dashboard Operativo — acceso para roles `admin`, `medico`, `operativo`.
// Shows today's tasks (with client-side toggle), treatment search, and
// static guide sections for Doris, Ceci, and Laura.
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

const ALLOWED_ROLES = ['admin', 'medico', 'operativo'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

function isAllowed(role: string): role is AllowedRole {
  return (ALLOWED_ROLES as readonly string[]).includes(role);
}

// Guides data — static content about each staff member's responsibilities
const guides = [
  {
    name: 'Doris',
    role: 'Coordinación & Recontacto',
    items: [
      'Gestión de la agenda diaria y confirmación de turnos',
      'Recontacto proactivo de pacientes sin turno en los últimos 60 días',
      'Seguimiento post-tratamiento: llamar a las 48 hs para consultas',
      'Registro de pacientes nuevos en el sistema',
    ],
  },
  {
    name: 'Ceci',
    role: 'Cosmetología & Cumpleaños',
    items: [
      'Aplicación de tratamientos cosmetológicos según protocolo',
      'Seguimiento de pacientes con tratamientos en curso',
      'Envío de felicitaciones y descuento de cumpleaños (10 días antes)',
      'Control de stock de productos de uso en cabina',
    ],
  },
  {
    name: 'Laura',
    role: 'Mystery Shopping & Calidad',
    items: [
      'Evaluación mensual de la experiencia del paciente (protocolo MS)',
      'Revisión de reseñas en Google y respuesta supervisada',
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

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single<{ id: string; role: string }>();

  if (!profile || !isAllowed(profile.role)) {
    redirect('/');
  }

  // Tasks for today assigned to the current user
  // Admins see all tasks; medico/operativo see only their own
  const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

  let query = supabase
    .from('employee_tasks')
    .select('id, title, description, is_completed')
    .eq('due_date', today)
    .order('is_completed', { ascending: true });

  if (profile.role !== 'admin') {
    query = query.eq('assigned_profile_id', profile.id);
  }

  const { data: tasksRaw, error: tasksError } = await query;
  const tasks: TaskItem[] = tasksRaw ? (tasksRaw as unknown as TaskItem[]) : [];

  const dateLabel = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Dashboard Operativo</h1>
        <span className={styles.date}>{dateLabel}</span>
      </div>

      {tasksError && (
        <div className={styles.errorBanner}>
          Error al cargar las tareas. Verificá la conexión.
        </div>
      )}

      <div className={styles.grid}>
        {/* Left column: tasks + search */}
        <div className={styles.leftCol}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Tareas del día</h2>
            <TaskList tasks={tasks} />
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Buscador de tratamientos</h2>
            <p className={styles.cardHelper}>
              102 tratamientos disponibles — escribí para filtrar
            </p>
            <TreatmentSearch />
          </section>
        </div>

        {/* Right column: guides */}
        <div className={styles.rightCol}>
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
