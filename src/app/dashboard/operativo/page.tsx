// Dashboard Operativo — acceso para roles `admin`, `medico`, `operativo`, `cosmetologa`.
// Lee tareas del día desde staff_tasks (reemplaza employee_tasks que estaba roto).
// Personaliza la vista según el nombre del usuario logueado.
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { assertSectionAccess } from '@/lib/permissions';
import { ensureDailyRecurringTasks } from '@/lib/tasks-generator';
import TaskList from '@/components/dashboard/TaskList';
import type { TaskItem } from '@/components/dashboard/TaskList';
import TreatmentSearch from '@/components/dashboard/TreatmentSearch';
import ConfiguracionOperativa from '@/components/dashboard/ConfiguracionOperativa';
import CampanasWidget from '@/components/dashboard/CampanasWidget';
import KioskAdmissionsList from '@/components/dashboard/KioskAdmissionsList';
import OrdersInbox, { OrderRecord } from '@/components/dashboard/OrdersInbox';
import StoreConfigSwitch from '@/components/dashboard/StoreConfigSwitch';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Dashboard Operativo | Dra. Landaburo',
};

// Guías de personal — Doris eliminada, solo Ceci y Laura
const guides = [
  {
    name: 'Ceci',
    role: 'Cosmiatría & Fidelización de Pacientes',
    items: [
      'Control de stock de productos e insumos de cabina (los viernes)',
      'Descarga de datos de Calu y actualización de Base Unificada (último día hábil del mes)',
      'Envío de saludos de cumpleaños según guía Drive (ver tareas del día)',
      'Solicitar reseña en Google Maps al finalizar cada atención',
      'Seguimiento de pacientes con productos por agotarse',
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
  if (!user) redirect('/login?redirectTo=/dashboard/operativo');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .maybeSingle<{ id: string; role: string; full_name: string | null }>();

  if (!profile || !profile.role || profile.role === 'paciente') {
    redirect('/portal/paciente');
  }
  const role = profile.role;

  // Guard server-side: la matriz de permisos es la unica fuente de verdad (R6)
  await assertSectionAccess(user.id, role, 'operativo');

  // Fecha de hoy en zona horaria Argentina
  const todayAR = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date()); // 'YYYY-MM-DD'

  // Generación "al vuelo" e idempotente de tareas recurrentes del día (ej: viernes de stock)
  await ensureDailyRecurringTasks(todayAR);

  // Read from staff_tasks with claimed_by, target_role and profile joins
  let tasks: TaskItem[] = [];
  try {
    let query = supabase
      .from('staff_tasks')
      .select(`
        id,
        title,
        description,
        status,
        due_date,
        target_role,
        assigned_profile_id,
        claimed_by,
        claimed_at,
        completed_by,
        completed_at,
        assigned_user:profiles!staff_tasks_assigned_profile_id_fkey(full_name),
        claimed_by_user:profiles!staff_tasks_claimed_by_fkey(full_name),
        completed_by_user:profiles!staff_tasks_completed_by_fkey(full_name)
      `)
      .lte('due_date', todayAR)
      .order('due_date', { ascending: true });

    if (profile.role !== 'admin') {
      query = query.or(
        `assigned_profile_id.eq.${profile.id},claimed_by.eq.${profile.id},and(assigned_profile_id.is.null,target_role.in.(operativo,${profile.role}))`
      );
    }

    const { data: tasksRaw, error: tasksErr } = await query;
    if (tasksErr) {
      console.error('[Dashboard/Operativo] Error consultando staff_tasks:', tasksErr);
    } else {
      tasks = (tasksRaw ?? []).map((t: any) => {
        const isMyTask = t.assigned_profile_id === profile.id || t.claimed_by === profile.id;
        const isTeamTask = !t.assigned_profile_id && !t.claimed_by;
        return {
          id: t.id,
          title: t.title,
          description: t.description ?? null,
          is_completed: t.status === 'completada',
          due_date: t.due_date ?? null,
          is_overdue: t.due_date ? t.due_date < todayAR : false,
          assigned_profile_id: t.assigned_profile_id,
          assigned_profile_name: t.assigned_user?.full_name || null,
          claimed_by: t.claimed_by,
          claimed_by_name: t.claimed_by_user?.full_name || null,
          completed_by: t.completed_by,
          completed_by_name: t.completed_by_user?.full_name || null,
          target_role: t.target_role,
          is_team_task: isTeamTask,
          is_my_task: isMyTask,
        };
      });
    }
  } catch (err) {
    console.error('[Dashboard/Operativo] Excepción en staff_tasks:', err);
    tasks = [];
  }

  // Query paid online orders for the Inbox
  let paidOrders: OrderRecord[] = [];
  try {
    const { data: ordersRaw, error: ordersErr } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        created_at,
        buyer_name,
        buyer_email,
        buyer_phone,
        customer_name,
        customer_email,
        customer_phone,
        total_ars,
        delivery_method,
        delivery_address,
        delivery_city,
        delivery_postal_code,
        delivery_notes,
        fulfillment_status,
        prepared_at,
        delivered_at,
        buyer_email_sent,
        buyer_email_error,
        staff_email_sent,
        staff_email_error,
        prepared_by_user:profiles!orders_prepared_by_fkey(full_name),
        delivered_by_user:profiles!orders_delivered_by_fkey(full_name),
        order_items(id, quantity, unit_price_ars, products(name))
      `)
      .in('payment_status', ['approved', 'paid'])
      .order('created_at', { ascending: false })
      .limit(25);

    if (ordersErr) {
      console.error('[Dashboard/Operativo] Error consultando órdenes:', ordersErr);
    } else if (ordersRaw) {
      paidOrders = ordersRaw.map((o: any) => ({
        id: o.id,
        order_number: o.order_number || `ORD-${o.id.slice(0, 8)}`,
        created_at: o.created_at,
        buyer_name: o.buyer_name || o.customer_name || 'Compradora',
        buyer_email: o.buyer_email || o.customer_email || 'Sin email',
        buyer_phone: o.buyer_phone || o.customer_phone || null,
        total_ars: Number(o.total_ars || 0),
        delivery_method: o.delivery_method || 'retiro',
        delivery_address: o.delivery_address,
        delivery_city: o.delivery_city,
        delivery_postal_code: o.delivery_postal_code,
        delivery_notes: o.delivery_notes,
        fulfillment_status: o.fulfillment_status || 'pendiente',
        prepared_at: o.prepared_at,
        prepared_by_name: o.prepared_by_user?.full_name || null,
        delivered_at: o.delivered_at,
        delivered_by_name: o.delivered_by_user?.full_name || null,
        buyer_email_sent: Boolean(o.buyer_email_sent),
        buyer_email_error: o.buyer_email_error,
        staff_email_sent: Boolean(o.staff_email_sent),
        staff_email_error: o.staff_email_error,
        items: (o.order_items || []).map((it: any) => ({
          id: it.id,
          product_name: it.products?.name || 'Producto',
          quantity: it.quantity,
          unit_price_ars: Number(it.unit_price_ars || 0),
        })),
      }));
    }
  } catch (err) {
    console.error('[Dashboard/Operativo] Excepción consultando órdenes:', err);
    paidOrders = [];
  }

  // Query store_config for admin toggles
  let storeConfig = {
    checkout_enabled: false,
    shipping_enabled: false,
  };
  try {
    const { data: scData } = await supabase
      .from('store_config')
      .select('checkout_enabled, shipping_enabled')
      .eq('id', 1)
      .maybeSingle();
    if (scData) {
      storeConfig = {
        checkout_enabled: Boolean(scData.checkout_enabled),
        shipping_enabled: Boolean(scData.shipping_enabled),
      };
    }
  } catch (err) {
    console.error('[Dashboard/Operativo] Error consultando store_config:', err);
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

  // Load operational assignment rules directly from recurring_task_rules (eliminando app_settings)
  let stockRule: { id: string; assigned_profile_id: string | null; title: string } | null = null;
  let birthdayRule: { id: string; assigned_profile_id: string | null; title: string } | null = null;
  let giftcardRule: { id: string; assigned_profile_id: string | null; title: string } | null = null;

  try {
    const { data: dbRules } = await supabase
      .from('recurring_task_rules')
      .select('id, title, recurrence_type, assigned_profile_id, is_active');

    if (dbRules) {
      const s = dbRules.find(
        (r) => r.recurrence_type === 'weekly_friday' || r.title?.toLowerCase().includes('stock')
      );
      if (s) stockRule = { id: s.id, assigned_profile_id: s.assigned_profile_id, title: s.title };

      const b = dbRules.find(
        (r) => r.recurrence_type === 'daily' || r.title?.toLowerCase().includes('cumpleaños')
      );
      if (b) birthdayRule = { id: b.id, assigned_profile_id: b.assigned_profile_id, title: b.title };

      const g = dbRules.find(
        (r) =>
          r.recurrence_type === 'on_demand' ||
          r.recurrence_type === 'event_triggered' ||
          r.title?.toLowerCase().includes('gift')
      );
      if (g) giftcardRule = { id: g.id, assigned_profile_id: g.assigned_profile_id, title: g.title };
    }
  } catch {
    // fallback if query fails
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

          {/* Bandeja de Pedidos Online (Tienda) */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Pedidos Online (Tienda)</h2>
            <p className={styles.cardHelper}>Armado, despacho y autoría de entregas web</p>
            <OrdersInbox orders={paidOrders} />
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Tareas del día</h2>
            <TaskList tasks={tasks} currentUserId={profile.id} currentUserRole={profile.role} />
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
            <p className={styles.cardHelper}>Catálogo de tratamientos disponibles — escribí para filtrar</p>
            <TreatmentSearch />
          </section>
        </div>

        {/* Right column: campaigns + guides + operational config */}
        <div className={styles.rightCol}>
          {/* Active Campaigns Widget */}
          <CampanasWidget campaigns={activeCampaigns} />

          {/* Operational Assignment Config & Store Switches for Admins */}
          {profile.role === 'admin' && (
            <>
              <StoreConfigSwitch
                checkoutEnabled={storeConfig.checkout_enabled}
                shippingEnabled={storeConfig.shipping_enabled}
              />
              <ConfiguracionOperativa
                profiles={staffProfiles}
                stockRule={stockRule}
                birthdayRule={birthdayRule}
                giftcardRule={giftcardRule}
              />
            </>
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

          {/* Guías de personal aisladas server-side (Parte 6):
              - Admin ve todas las guías
              - Cada colaboradora ve únicamente la suya (Ceci ve Ceci, Laura ve Laura) */}
          {(() => {
            const userFullName = (profile.full_name ?? '').toLowerCase();
            const visibleGuides = profile.role === 'admin'
              ? guides
              : guides.filter((g) => {
                  const guideNameLower = g.name.toLowerCase();
                  if (guideNameLower === 'ceci' && (userFullName.includes('ceci') || userFullName.includes('cecilia'))) return true;
                  if (guideNameLower === 'laura' && (userFullName.includes('laura') || userFullName.includes('dzuryk'))) return true;
                  return false;
                });

            if (visibleGuides.length === 0) return null;

            return (
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>
                  {profile.role === 'admin' ? 'Guías de personal' : `Tu guía de trabajo (${visibleGuides[0].name})`}
                </h2>
                <div className={styles.guides}>
                  {visibleGuides.map((guide) => (
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
            );
          })()}
        </div>
      </div>
    </div>
  );
}
